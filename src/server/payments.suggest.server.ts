import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { matchPayment } from '#/api/paymentMatch'
import type { PaymentMatch } from '#/api/paymentMatch'
import type { DB } from './db.gen'

type Trx = Kysely<DB>

// Open means no confirmed link yet; open suggestions are dropped first and made again, so the strongest pair wins
// whatever the order things arrived in. A rejected pair is never suggested again.
async function loadOpen(trx: Trx, orgId: string) {
  await trx
    .deleteFrom('invoice_payments')
    .where('organisation_id', '=', orgId)
    .where('status', '=', 'suggested')
    .execute()
  const links = await trx
    .selectFrom('invoice_payments')
    .select(['invoice_id', 'bank_transaction_id', 'status'])
    .where('organisation_id', '=', orgId)
    .execute()
  const busyTx = new Set(
    links
      .filter((l) => l.status !== 'rejected')
      .map((l) => l.bank_transaction_id),
  )
  const refused = new Set(
    links
      .filter((l) => l.status === 'rejected')
      .map((l) => `${l.invoice_id}/${l.bank_transaction_id}`),
  )
  const invoices = await trx
    .selectFrom('invoices')
    .select([
      'id',
      'number',
      'ocr',
      sql<string>`invoice_open(id)`.as('open_ore'),
      sql<string>`invoice_date::text`.as('invoice_date'),
      sql<string>`due_date::text`.as('due_date'),
      sql<string>`buyer->>'name'`.as('buyer'),
    ])
    .where('organisation_id', '=', orgId)
    .where('kind', '=', 'invoice')
    .where('status', '=', 'sent')
    .where(sql<boolean>`invoice_open(id) > 0`)
    .execute()
  const transactions = (
    await trx
      .selectFrom('bank_transactions')
      .select(['id', 'amount_ore', 'counterparty', 'reference'])
      .select(sql<string>`booking_date::text`.as('booking_date'))
      .where('organisation_id', '=', orgId)
      .where('amount_ore', '>', '0')
      .execute()
  ).filter((t) => !busyTx.has(t.id))
  return { invoices, transactions, busyTx, refused }
}

type Candidate = {
  invoice: string
  tx: string
  covers: number
  m: PaymentMatch
  gap: number
}

// Every pair that passes, strongest first; among equals the payment closest in date to the invoice.
function candidates(open: Awaited<ReturnType<typeof loadOpen>>) {
  const all: Candidate[] = []
  for (const i of open.invoices) {
    for (const t of open.transactions) {
      if (open.refused.has(`${i.id}/${t.id}`)) continue
      const paid = Number(t.amount_ore)
      const m = matchPayment(
        {
          number: Number(i.number),
          ocr: i.ocr ?? '',
          open_ore: Number(i.open_ore),
          invoice_date: i.invoice_date,
          due_date: i.due_date,
          buyer: i.buyer,
        },
        {
          amount_ore: paid,
          booking_date: t.booking_date,
          counterparty: t.counterparty,
          reference: t.reference,
        },
      )
      if (!m) continue
      all.push({
        invoice: i.id,
        tx: t.id,
        covers: Math.min(paid, Number(i.open_ore)),
        m,
        gap: Math.abs(Date.parse(t.booking_date) - Date.parse(i.invoice_date)),
      })
    }
  }
  return all.sort((x, y) => y.m.confidence - x.m.confidence || x.gap - y.gap)
}

// One suggestion per invoice and per payment, strongest pass first.
// shortcut: compares every open invoice with every unlinked payment in memory, move it to SQL when an organisation holds tens of thousands.
export async function suggestPayments(trx: Trx, orgId: string) {
  const open = await loadOpen(trx, orgId)
  const usedInvoices = new Set<string>()
  let made = 0
  for (const c of candidates(open)) {
    if (usedInvoices.has(c.invoice) || open.busyTx.has(c.tx)) continue
    usedInvoices.add(c.invoice)
    open.busyTx.add(c.tx)
    const inserted = await trx
      .insertInto('invoice_payments')
      .values({
        organisation_id: orgId,
        invoice_id: c.invoice,
        bank_transaction_id: c.tx,
        status: 'suggested',
        pass: c.m.pass,
        confidence: c.m.confidence.toFixed(2),
        reason: c.m.reason,
        covers_ore: c.covers,
      })
      // A concurrent run may have made the same suggestion first.
      .onConflict((oc) =>
        oc.columns(['invoice_id', 'bank_transaction_id']).doNothing(),
      )
      .returning('id')
      .execute()
    made += inserted.length
  }
  return made
}

import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { matchPass } from '#/api/receiptMatch'
import type { Match } from '#/api/receiptMatch'
import type { DB } from './db.gen'
import { settingsOf } from './receipts.settings.server'

type Trx = Kysely<DB>

// Open means no confirmed link yet; open suggestions are dropped first and made again, so the strongest pair
// wins whatever the order things arrived in. A rejected pair is never suggested again.
async function loadOpen(trx: Trx, orgId: string) {
  await trx
    .deleteFrom('receipt_matches')
    .where('organisation_id', '=', orgId)
    .where('status', '=', 'suggested')
    .execute()
  const links = await trx
    .selectFrom('receipt_matches')
    .select(['receipt_id', 'bank_transaction_id', 'status'])
    .where('organisation_id', '=', orgId)
    .execute()
  const live = links.filter((m) => m.status !== 'rejected')
  const busyReceipts = new Set(live.map((m) => m.receipt_id))
  const busyTx = new Set(live.map((m) => m.bank_transaction_id))
  const refused = new Set(
    links
      .filter((m) => m.status === 'rejected')
      .map((m) => `${m.receipt_id}/${m.bank_transaction_id}`),
  )
  const receipts = (
    await trx
      .selectFrom('receipts')
      .select(['id', 'supplier', 'amount_ore', 'reference', 'giro'])
      .select(sql<string | null>`receipt_date::text`.as('receipt_date'))
      .where('organisation_id', '=', orgId)
      .where('amount_ore', 'is not', null)
      .execute()
  ).filter((r) => !busyReceipts.has(r.id))
  const transactions = (
    await trx
      .selectFrom('bank_transactions')
      .select(['id', 'amount_ore', 'counterparty', 'reference'])
      .select(sql<string>`booking_date::text`.as('booking_date'))
      .where('organisation_id', '=', orgId)
      .where('amount_ore', '<', '0')
      .execute()
  ).filter((t) => !busyTx.has(t.id))
  const aliases = await trx
    .selectFrom('supplier_aliases')
    .select(['supplier', 'bank_text'])
    .where('organisation_id', '=', orgId)
    .execute()
  return { receipts, transactions, aliases, busyTx, refused }
}

type Open = Awaited<ReturnType<typeof loadOpen>>

type Candidate = {
  receipt: Open['receipts'][number]
  id: string
  paid: number
  amount: number
  m: Match
  gap: number
}

// Every pair that passes, strongest first; among equals the payment closest in date to the receipt.
function candidates(open: Open) {
  const all: Candidate[] = []
  for (const r of open.receipts) {
    const names = open.aliases
      .filter((a) => a.supplier === (r.supplier ?? '').toLowerCase().trim())
      .map((a) => a.bank_text)
    const facts = {
      supplier: r.supplier,
      amount_ore: Number(r.amount_ore),
      receipt_date: r.receipt_date,
      reference: r.reference,
      giro: r.giro,
    }
    for (const t of open.transactions) {
      if (open.refused.has(`${r.id}/${t.id}`)) continue
      const m = matchPass(
        facts,
        {
          amount_ore: Number(t.amount_ore),
          booking_date: t.booking_date,
          counterparty: t.counterparty,
          reference: t.reference,
        },
        names,
      )
      if (!m) continue
      const gap = Math.abs(
        Date.parse(t.booking_date) -
          Date.parse(r.receipt_date ?? t.booking_date),
      )
      all.push({
        receipt: r,
        id: t.id,
        paid: -Number(t.amount_ore),
        amount: facts.amount_ore,
        m,
        gap,
      })
    }
  }
  return all.sort((x, y) => y.m.confidence - x.m.confidence || x.gap - y.gap)
}

// One suggestion per receipt and per payment, strongest pass first.
// shortcut: compares every open receipt with every open payment in memory, move it to SQL when an organisation holds tens of thousands.
export async function suggest(trx: Trx, orgId: string) {
  if (!(await settingsOf(trx, orgId)).suggestions) return 0
  const open = await loadOpen(trx, orgId)
  if (!open.receipts.length) return 0
  const usedReceipts = new Set<string>()
  let made = 0
  for (const c of candidates(open)) {
    if (usedReceipts.has(c.receipt.id) || open.busyTx.has(c.id)) continue
    usedReceipts.add(c.receipt.id)
    open.busyTx.add(c.id)
    const inserted = await trx
      .insertInto('receipt_matches')
      .values({
        organisation_id: orgId,
        receipt_id: c.receipt.id,
        bank_transaction_id: c.id,
        status: 'suggested',
        pass: c.m.pass,
        confidence: c.m.confidence.toFixed(2),
        reason: c.m.reason,
        covers_ore: Math.min(c.amount, c.paid),
      })
      // A concurrent run may have made the same suggestion first.
      .onConflict((oc) =>
        oc.columns(['receipt_id', 'bank_transaction_id']).doNothing(),
      )
      .returning('id')
      .execute()
    made += inserted.length
  }
  return made
}

import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { matchPass } from '#/api/receiptMatch'
import type { Match } from '#/api/receiptMatch'
import type { DB } from './db.gen'
import { settingsOf } from './receipts.settings.server'

type Trx = Kysely<DB>

// Open means no suggestion or confirmed link yet; a rejected pair is never suggested again.
async function loadOpen(trx: Trx, orgId: string) {
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

function bestFor(r: Open['receipts'][number], open: Open) {
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
  let best: { id: string; paid: number; m: Match } | undefined
  for (const t of open.transactions) {
    if (open.busyTx.has(t.id) || open.refused.has(`${r.id}/${t.id}`)) continue
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
    if (m && (!best || m.confidence > best.m.confidence))
      best = { id: t.id, paid: -Number(t.amount_ore), m }
  }
  return best && { ...best, amount: facts.amount_ore }
}

// One suggestion per receipt: the strongest pass over the payments nothing is linked to yet.
// shortcut: compares every open receipt with every open payment in memory, move it to SQL when an organisation holds tens of thousands.
export async function suggest(trx: Trx, orgId: string) {
  if (!(await settingsOf(trx, orgId)).suggestions) return 0
  const open = await loadOpen(trx, orgId)
  let made = 0
  for (const r of open.receipts) {
    const best = bestFor(r, open)
    if (!best) continue
    open.busyTx.add(best.id)
    await trx
      .insertInto('receipt_matches')
      .values({
        organisation_id: orgId,
        receipt_id: r.id,
        bank_transaction_id: best.id,
        status: 'suggested',
        pass: best.m.pass,
        confidence: best.m.confidence.toFixed(2),
        reason: best.m.reason,
        covers_ore: Math.min(best.amount, best.paid),
      })
      .execute()
    made++
  }
  return made
}

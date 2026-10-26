import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { audited, HttpError, require } from './access.server'
import type { Audit } from './access.server'
import type { DB } from './db.gen'
import { settingsOf } from './receipts.settings.server'
import { suggest } from './receipts.suggest.server'
import { inOrganisation } from './tenant.server'

type Trx = Kysely<DB>

const sumOf = async (
  trx: Trx,
  column: 'receipt_id' | 'bank_transaction_id',
  id: string,
) => {
  const row = await trx
    .selectFrom('receipt_matches')
    .select(sql<string>`coalesce(sum(covers_ore), 0)`.as('s'))
    .where(column, '=', id)
    .where('status', '=', 'confirmed')
    .executeTakeFirstOrThrow()
  return Number(row.s)
}

// What a receipt and a transaction still have to cover; the covered amounts on each side may not exceed them.
async function room(trx: Trx, receiptId: string, txId: string) {
  // Row locks, receipt first, so two decisions on the same receipt or payment run one after the other.
  const r = await trx
    .selectFrom('receipts')
    .select('amount_ore')
    .where('id', '=', receiptId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  const t = await trx
    .selectFrom('bank_transactions')
    .select('amount_ore')
    .where('id', '=', txId)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (r.amount_ore === null) throw new HttpError(409, 'receipt_incomplete')
  return Math.min(
    Number(r.amount_ore) - (await sumOf(trx, 'receipt_id', receiptId)),
    -Number(t.amount_ore) - (await sumOf(trx, 'bank_transaction_id', txId)),
  )
}

// Accept or reject a suggestion. Nothing is booked either way.
export const decide = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  matchId: string,
  verdict: 'confirmed' | 'rejected',
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'bookkeeping.manage')
    const m = await trx
      .selectFrom('receipt_matches')
      .select(['receipt_id', 'bank_transaction_id', 'covers_ore', 'status'])
      .where('id', '=', matchId)
      .where('organisation_id', '=', orgId)
      .forUpdate()
      .executeTakeFirst()
    if (!m) throw new HttpError(404, 'not_found')
    if (m.status !== 'suggested') throw new HttpError(409, 'already_decided')
    if (
      verdict === 'confirmed' &&
      Number(m.covers_ore) >
        (await room(trx, m.receipt_id, m.bank_transaction_id))
    )
      throw new HttpError(409, 'sum_exceeds')
    await trx
      .updateTable('receipt_matches')
      .set({ status: verdict, decided_at: sql`now()` })
      .where('id', '=', matchId)
      .execute()
    await audited(trx, 'receipt_match_decided', base, orgId, {
      match: matchId,
      verdict,
    })
    if (verdict === 'rejected') await suggest(trx, orgId)
  })

// A person links a receipt to a transaction of their choice, replacing any open suggestion for the receipt.
// The supplier is remembered against the bank text, so the next suggestion finds it.
export const link = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  receiptId: string,
  transactionId: string,
  coversOre: number | undefined,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'bookkeeping.manage')
    const r = await trx
      .selectFrom('receipts')
      .select('supplier')
      .where('id', '=', receiptId)
      .where('organisation_id', '=', orgId)
      .executeTakeFirst()
    const t = await trx
      .selectFrom('bank_transactions')
      .select(['amount_ore', 'counterparty'])
      .where('id', '=', transactionId)
      .where('organisation_id', '=', orgId)
      .executeTakeFirst()
    if (!r || !t || Number(t.amount_ore) >= 0)
      throw new HttpError(404, 'not_found')
    const same = await trx
      .selectFrom('receipt_matches')
      .select('id')
      .where('receipt_id', '=', receiptId)
      .where('bank_transaction_id', '=', transactionId)
      .where('status', '=', 'confirmed')
      .executeTakeFirst()
    if (same) throw new HttpError(409, 'already_decided')
    const left = await room(trx, receiptId, transactionId)
    const amount = coversOre ?? left
    if (amount < 1 || amount > left) throw new HttpError(409, 'sum_exceeds')
    // An open suggestion for this receipt is overruled; its pair is not suggested again.
    await trx
      .updateTable('receipt_matches')
      .set({ status: 'rejected', decided_at: sql`now()` })
      .where('receipt_id', '=', receiptId)
      .where('status', '=', 'suggested')
      .execute()
    const row = await trx
      .insertInto('receipt_matches')
      .values({
        organisation_id: orgId,
        receipt_id: receiptId,
        bank_transaction_id: transactionId,
        status: 'confirmed',
        covers_ore: amount,
        decided_at: sql`now()`,
      })
      .onConflict((oc) =>
        oc.columns(['receipt_id', 'bank_transaction_id']).doUpdateSet({
          status: 'confirmed',
          covers_ore: amount,
          decided_at: sql`now()`,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow()
    if (r.supplier && t.counterparty)
      await trx
        .insertInto('supplier_aliases')
        .values({
          organisation_id: orgId,
          supplier: r.supplier.toLowerCase().trim(),
          bank_text: t.counterparty,
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    await audited(trx, 'receipt_match_decided', base, orgId, {
      match: row.id,
      verdict: 'linked',
    })
    await suggest(trx, orgId)
    return { id: row.id }
  })

export const setSuggestions = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  on: boolean,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'bookkeeping.manage')
    await settingsOf(trx, orgId)
    await trx
      .updateTable('receipt_settings')
      .set({ suggestions: on })
      .where('organisation_id', '=', orgId)
      .execute()
    await audited(trx, 'receipt_suggestions_changed', base, orgId, {
      on: String(on),
    })
    if (on) await suggest(trx, orgId)
    else
      await trx
        .deleteFrom('receipt_matches')
        .where('organisation_id', '=', orgId)
        .where('status', '=', 'suggested')
        .execute()
  })

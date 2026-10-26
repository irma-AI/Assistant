import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { Audit } from './access.server'
import { access, audited, HttpError } from './access.server'
import type { DB } from './db.gen'
import { storeDocument } from './documents.server'
import { suggest } from './receipts.suggest.server'
import { inOrganisation } from './tenant.server'

type Trx = Kysely<DB>
export type ReceiptFields = {
  supplier?: string | null
  amount_ore?: number | null
  receipt_date?: string | null
  reference?: string | null
  giro?: string | null
}

// What a receipt with no confirmed sum left to cover and a transaction with none left are called matched.
const toleranceOre = 500

export const uploadReceipt = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  name: string,
  bytes: Uint8Array,
  source: 'upload' | 'photo' | 'email',
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId) // every member may upload a receipt
    return addReceipt(trx, orgId, name, bytes, source, base)
  })

// Also the way in for the mail job, which has no user.
export async function addReceipt(
  trx: Trx,
  orgId: string,
  name: string,
  bytes: Uint8Array,
  source: 'upload' | 'photo' | 'email',
  base: Audit,
  mailContext: string | null = null,
) {
  const doc = await storeDocument(trx, orgId, name, bytes, base)
  const row = await trx
    .insertInto('receipts')
    .values({
      organisation_id: orgId,
      document_id: doc.id,
      source,
      mail_context: mailContext,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await audited(trx, 'receipt_added', base, orgId, { receipt: row.id, source })
  return { id: row.id, document_id: doc.id }
}

// The amount of a receipt a confirmed match rests on is not edited.
async function amountMayChange(trx: Trx, id: string) {
  const m = await trx
    .selectFrom('receipt_matches')
    .select('id')
    .where('receipt_id', '=', id)
    .where('status', '=', 'confirmed')
    .executeTakeFirst()
  if (m) throw new HttpError(409, 'receipt_matched')
}

export const updateReceipt = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  fields: ReceiptFields,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    if (fields.amount_ore !== undefined) await amountMayChange(trx, id)
    const r = await trx
      .updateTable('receipts')
      .set(fields)
      .where('id', '=', id)
      .where('organisation_id', '=', orgId)
      .returning('id')
      .executeTakeFirst()
    if (!r) throw new HttpError(404, 'not_found')
    await audited(trx, 'receipt_updated', base, orgId, { receipt: id })
    await suggest(trx, orgId)
  })

const suggestedAccount = async (trx: Trx, orgId: string, supplier: string) => {
  const row = await trx
    .selectFrom('voucher_lines as l')
    .innerJoin('vouchers as v', 'v.id', 'l.voucher_id')
    .innerJoin('voucher_documents as vd', 'vd.voucher_id', 'v.id')
    .innerJoin('receipts as r', (j) =>
      j
        .onRef('r.document_id', '=', 'vd.document_id')
        .onRef('r.organisation_id', '=', 'vd.organisation_id'),
    )
    .innerJoin('accounts as a', (j) =>
      j
        .onRef('a.number', '=', 'l.account')
        .onRef('a.organisation_id', '=', 'l.organisation_id'),
    )
    .select(['a.number', 'a.name', sql<string>`count(*)`.as('n')])
    .where('v.organisation_id', '=', orgId)
    .where('v.status', '=', 'posted')
    .where('l.debit', '>', '0')
    .where(sql<boolean>`l.account >= '4'`)
    .where(
      sql<boolean>`lower(trim(r.supplier)) = ${supplier.toLowerCase().trim()}`,
    )
    .groupBy(['a.number', 'a.name'])
    .orderBy('n', 'desc')
    .limit(1)
    .executeTakeFirst()
  return row ? { number: row.number, name: row.name } : null
}

export const listReceipts = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const receipts = await trx
      .selectFrom('receipts')
      .innerJoin('documents', 'documents.id', 'receipts.document_id')
      .select([
        'receipts.id',
        'receipts.document_id',
        'documents.name',
        'receipts.supplier',
        'receipts.amount_ore',
        sql<string | null>`receipts.receipt_date::text`.as('receipt_date'),
        'receipts.reference',
        'receipts.giro',
        'receipts.source',
        'receipts.mail_context',
        'receipts.created_at',
      ])
      .where('receipts.organisation_id', '=', orgId)
      .orderBy('receipts.created_at', 'desc')
      .limit(500)
      .execute()
    const matches = await trx
      .selectFrom('receipt_matches as m')
      .innerJoin('bank_transactions as t', 't.id', 'm.bank_transaction_id')
      .select([
        'm.id',
        'm.receipt_id',
        'm.status',
        'm.pass',
        'm.confidence',
        'm.reason',
        'm.covers_ore',
        't.id as transaction_id',
        't.amount_ore as transaction_amount_ore',
        sql<string>`t.booking_date::text`.as('booking_date'),
        't.counterparty',
      ])
      .where('m.organisation_id', '=', orgId)
      .where('m.status', '!=', 'rejected')
      .execute()
    return Promise.all(
      receipts.map(async (r) => ({
        ...r,
        amount_ore: r.amount_ore === null ? null : Number(r.amount_ore),
        matches: matches
          .filter((m) => m.receipt_id === r.id)
          .map((m) => ({
            id: m.id,
            status: m.status,
            pass: m.pass,
            confidence: m.confidence === null ? null : Number(m.confidence),
            reason: m.reason,
            covers_ore: Number(m.covers_ore),
            transaction: {
              id: m.transaction_id,
              amount_ore: Number(m.transaction_amount_ore),
              booking_date: m.booking_date,
              counterparty: m.counterparty,
            },
          })),
        suggested_account: r.supplier
          ? await suggestedAccount(trx, orgId, r.supplier)
          : null,
      })),
    )
  })

// Payments no receipt covers yet, newest first.
export const unmatchedTransactions = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const rows = await trx
      .selectFrom('bank_transactions as t')
      .select([
        't.id',
        't.amount_ore',
        sql<string>`t.booking_date::text`.as('booking_date'),
        't.counterparty',
        't.reference',
      ])
      .where('t.organisation_id', '=', orgId)
      .where('t.amount_ore', '<', '0')
      .where(
        sql<boolean>`(coalesce((select sum(m.covers_ore) from receipt_matches m where m.bank_transaction_id = t.id and m.status = 'confirmed'), 0) = 0 or (select sum(m.covers_ore) from receipt_matches m where m.bank_transaction_id = t.id and m.status = 'confirmed') < -t.amount_ore - ${toleranceOre})`,
      )
      .orderBy('t.booking_date', 'desc')
      .limit(500)
      .execute()
    return rows.map((r) => ({ ...r, amount_ore: Number(r.amount_ore) }))
  })

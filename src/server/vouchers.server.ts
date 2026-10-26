import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import type { voucherInput } from '#/api/bookkeeping'
import { access, HttpError } from './access.server'
import { manage, mapped } from './bookkeeping.shared.server'
import type { Trx } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

// ---- Vouchers

export type VoucherInput = z.output<typeof voucherInput>

export const yearFor = async (trx: Trx, orgId: string, date: string) => {
  const y = await trx
    .selectFrom('fiscal_years')
    .select('id')
    .where('organisation_id', '=', orgId)
    .where(sql<boolean>`${date}::date between starts_on and ends_on`)
    .executeTakeFirst()
  if (!y) throw new HttpError(422, 'no_fiscal_year')
  return y.id
}

const total = (lines: VoucherInput['lines'], side: 'debit' | 'credit') =>
  lines.reduce((sum, l) => sum + l[side], 0)

export async function writeLines(
  trx: Trx,
  orgId: string,
  voucherId: string,
  lines: VoucherInput['lines'],
) {
  const numbers = [...new Set(lines.map((l) => l.account))]
  const known = await trx
    .selectFrom('accounts')
    .select('number')
    .where('organisation_id', '=', orgId)
    .where('number', 'in', numbers)
    .where('active', '=', true)
    .execute()
  if (known.length !== numbers.length)
    throw new HttpError(422, 'unknown_account')
  await trx
    .insertInto('voucher_lines')
    .values(
      lines.map((l, i) => ({
        organisation_id: orgId,
        voucher_id: voucherId,
        line_no: i + 1,
        account: l.account,
        debit: l.debit,
        credit: l.credit,
        text: l.text ?? null,
      })),
    )
    .execute()
}

const summaryColumns = [
  'vouchers.id',
  'vouchers.fiscal_year_id',
  'vouchers.status',
  'vouchers.number',
  sql<string>`vouchers.voucher_date::text`.as('voucher_date'),
  'vouchers.description',
  'vouchers.created_by_name',
  'vouchers.created_at',
  'vouchers.posted_by_name',
  'vouchers.posted_at',
  'vouchers.app_version',
  'vouchers.reverses_id',
] as const

// bigint columns reach Node as strings; a voucher number is small enough for a number.
const num = <T extends { number: string | null }>(v: T) => ({
  ...v,
  number: v.number === null ? null : Number(v.number),
})

export const listVouchers = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  fiscalYearId?: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    let q = trx
      .selectFrom('vouchers')
      .select(summaryColumns)
      .where('vouchers.organisation_id', '=', orgId)
    if (fiscalYearId) q = q.where('vouchers.fiscal_year_id', '=', fiscalYearId)
    return q
      .orderBy('vouchers.fiscal_year_id')
      .orderBy('vouchers.number')
      .orderBy('vouchers.created_at')
      .limit(500)
      .execute()
      .then((rows) => rows.map(num))
  })

// What booking will record, exactly: the lines, the totals and whether they balance.
export async function readVoucher(trx: Trx, orgId: string, id: string) {
  const v = await trx
    .selectFrom('vouchers')
    .select(summaryColumns)
    .where('vouchers.organisation_id', '=', orgId)
    .where('vouchers.id', '=', id)
    .executeTakeFirst()
  if (!v) throw new HttpError(404, 'not_found')
  const lines = (
    await trx
      .selectFrom('voucher_lines')
      .select(['line_no', 'account', 'debit', 'credit', 'text'])
      .where('organisation_id', '=', orgId)
      .where('voucher_id', '=', id)
      .orderBy('line_no')
      .execute()
  ).map((l) => ({ ...l, debit: Number(l.debit), credit: Number(l.credit) }))
  const documents = await trx
    .selectFrom('voucher_documents')
    .innerJoin('documents', 'documents.id', 'voucher_documents.document_id')
    .select(['documents.id', 'documents.name', 'documents.sha256'])
    .where('voucher_documents.organisation_id', '=', orgId)
    .where('voucher_documents.voucher_id', '=', id)
    .execute()
  const reversedBy = await trx
    .selectFrom('vouchers')
    .select(['id', 'number', 'fiscal_year_id'])
    .where('organisation_id', '=', orgId)
    .where('reverses_id', '=', id)
    .executeTakeFirst()
  const debit = total(lines, 'debit')
  const credit = total(lines, 'credit')
  return {
    ...num(v),
    lines,
    documents,
    reversed_by: reversedBy ? num(reversedBy) : null,
    totals: { debit, credit, balanced: debit === credit && debit > 0 },
  }
}

export const getVoucher = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return readVoucher(trx, orgId, id)
  })

export const createVoucher = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: VoucherInput,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      const v = await trx
        .insertInto('vouchers')
        .values({
          organisation_id: orgId,
          fiscal_year_id: await yearFor(trx, orgId, input.voucher_date),
          voucher_date: input.voucher_date,
          description: input.description,
          created_by: who.id,
          created_by_name: who.name,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      await writeLines(trx, orgId, v.id, input.lines)
      return readVoucher(trx, orgId, v.id)
    }),
  )

export const draft = async (trx: Trx, orgId: string, id: string) => {
  const v = await trx
    .selectFrom('vouchers')
    .select('status')
    .where('organisation_id', '=', orgId)
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst()
  if (!v) throw new HttpError(404, 'not_found')
  if (v.status !== 'draft') throw new HttpError(409, 'not_draft')
}

export const replaceDraft = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  input: VoucherInput,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      await manage(trx, userId, orgId)
      await draft(trx, orgId, id)
      await trx
        .updateTable('vouchers')
        .set({
          fiscal_year_id: await yearFor(trx, orgId, input.voucher_date),
          voucher_date: input.voucher_date,
          description: input.description,
        })
        .where('organisation_id', '=', orgId)
        .where('id', '=', id)
        .execute()
      await trx
        .deleteFrom('voucher_lines')
        .where('organisation_id', '=', orgId)
        .where('voucher_id', '=', id)
        .execute()
      await writeLines(trx, orgId, id, input.lines)
      return readVoucher(trx, orgId, id)
    }),
  )

export const deleteDraft = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await manage(trx, userId, orgId)
    await draft(trx, orgId, id)
    await trx
      .deleteFrom('vouchers')
      .where('organisation_id', '=', orgId)
      .where('id', '=', id)
      .execute()
  })

export const attachDocument = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  documentId: string,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      await manage(trx, userId, orgId)
      await draft(trx, orgId, id)
      const d = await trx
        .selectFrom('documents')
        .select('retain_until')
        .where('organisation_id', '=', orgId)
        .where('id', '=', documentId)
        .executeTakeFirst()
      if (!d) throw new HttpError(404, 'not_found')
      if (d.retain_until) throw new HttpError(409, 'document_linked')
      await trx
        .insertInto('voucher_documents')
        .values({
          organisation_id: orgId,
          voucher_id: id,
          document_id: documentId,
        })
        .execute()
      return readVoucher(trx, orgId, id)
    }),
  ).catch((e: unknown) => {
    if (e instanceof HttpError && e.message === 'conflict')
      throw new HttpError(409, 'document_linked')
    throw e
  })

// "Bokför": the database numbers the voucher in this transaction and freezes it.

import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import { HttpError } from './access.server'
import { mapped } from './bookkeeping.shared.server'
import type { Trx } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import type { invoiceInput } from '#/api/invoices'
import { manage, readInvoice } from './invoices.read.server'
import { inOrganisation } from './tenant.server'

type Input = z.output<typeof invoiceInput>

const today = () => new Date().toISOString().slice(0, 10)
const addDays = (day: string, n: number) =>
  new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10)

// ---- Drafts

async function writeInvoiceLines(
  trx: Trx,
  orgId: string,
  invoiceId: string,
  lines: Input['lines'],
) {
  await trx
    .insertInto('invoice_lines')
    .values(
      lines.map((l, i) => ({
        organisation_id: orgId,
        invoice_id: invoiceId,
        line_no: i + 1,
        description: l.description,
        quantity_milli: Math.round(l.quantity * 1000),
        unit: l.unit,
        unit_price: l.unit_price,
        vat_code: l.vat_code,
      })),
    )
    .execute()
}

// The due date defaults to the customer's payment terms, 30 days if it has none (Räntelagen 4 §).
async function terms(trx: Trx, orgId: string, customerId: string) {
  const c = await trx
    .selectFrom('customers')
    .select('payment_terms_days')
    .where('organisation_id', '=', orgId)
    .where('id', '=', customerId)
    .executeTakeFirst()
  if (!c) throw new HttpError(422, 'customer_missing')
  return c.payment_terms_days ?? 30
}

export const createInvoice = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: Input,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      if (!input.customer_id) throw new HttpError(400, 'bad_request', false)
      const days = await terms(trx, orgId, input.customer_id)
      const row = await trx
        .insertInto('invoices')
        .values({
          organisation_id: orgId,
          customer_id: input.customer_id,
          invoice_date: input.invoice_date,
          supply_date: input.supply_date ?? input.invoice_date,
          due_date: input.due_date ?? addDays(input.invoice_date, days),
          reference: input.reference ?? null,
          created_by: who.id,
          created_by_name: who.name,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      await writeInvoiceLines(trx, orgId, row.id, input.lines)
      return readInvoice(trx, orgId, row.id)
    }),
  )

export async function draft(trx: Trx, orgId: string, id: string) {
  const v = await trx
    .selectFrom('invoices')
    .select(['status', 'kind', 'customer_id'])
    .where('organisation_id', '=', orgId)
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst()
  if (!v) throw new HttpError(404, 'not_found')
  if (v.status !== 'draft') throw new HttpError(409, 'not_draft')
  return v
}

export const replaceDraft = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  input: Input,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      await manage(trx, userId, orgId)
      const d = await draft(trx, orgId, id)
      // A credit note keeps the original's buyer, and falls due when it is dated.
      const customerId =
        d.kind === 'credit_note' ? d.customer_id : input.customer_id
      const days = customerId ? await terms(trx, orgId, customerId) : 0
      if (d.kind === 'invoice' && !customerId)
        throw new HttpError(400, 'bad_request', false)
      await trx
        .updateTable('invoices')
        .set({
          customer_id: customerId,
          invoice_date: input.invoice_date,
          supply_date: input.supply_date ?? input.invoice_date,
          due_date:
            input.due_date ??
            addDays(input.invoice_date, d.kind === 'invoice' ? days : 0),
          reference: input.reference ?? null,
        })
        .where('organisation_id', '=', orgId)
        .where('id', '=', id)
        .execute()
      await trx
        .deleteFrom('invoice_lines')
        .where('organisation_id', '=', orgId)
        .where('invoice_id', '=', id)
        .execute()
      await writeInvoiceLines(trx, orgId, id, input.lines)
      return readInvoice(trx, orgId, id)
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
      .deleteFrom('invoices')
      .where('organisation_id', '=', orgId)
      .where('id', '=', id)
      .execute()
  })

// A credit note starts as a copy of the original's lines; edit it down for a partial credit. The database refuses
// credit notes that together exceed the original.
export const createCredit = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      const o = await trx
        .selectFrom('invoices')
        .select(['status', 'kind', 'customer_id'])
        .where('organisation_id', '=', orgId)
        .where('id', '=', id)
        .executeTakeFirst()
      if (!o) throw new HttpError(404, 'not_found')
      if (o.status !== 'sent' || o.kind !== 'invoice')
        throw new HttpError(409, 'not_creditable')
      const day = today()
      const row = await trx
        .insertInto('invoices')
        .values({
          organisation_id: orgId,
          kind: 'credit_note',
          credits_id: id,
          customer_id: o.customer_id,
          invoice_date: day,
          supply_date: day,
          due_date: day,
          created_by: who.id,
          created_by_name: who.name,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      await sql`insert into invoice_lines (organisation_id, invoice_id, line_no, description, quantity_milli, unit, unit_price, vat_code)
        select organisation_id, ${row.id}::uuid, line_no, description, quantity_milli, unit, unit_price, vat_code
        from invoice_lines where invoice_id = ${id}`.execute(trx)
      return readInvoice(trx, orgId, row.id)
    }),
  )

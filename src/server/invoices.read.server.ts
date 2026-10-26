import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { access, HttpError, require } from './access.server'
import { actor } from './bookkeeping.shared.server'
import type { Trx } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

// The copies kept on a sent invoice (IRM-144 decision 4).
export const buyerJson = z.object({
  kind: z.enum(['business', 'consumer']),
  name: z.string(),
  address: z.string(),
  email: z.string().nullable(),
  language: z.enum(['sv', 'en']),
  org_number: z.string().nullable(),
  vat_number: z.string().nullable(),
})
export const sellerJson = z.object({
  legal_name: z.string(),
  org_number: z.string(),
  vat_number: z.string(),
  seat: z.string(),
  street: z.string(),
  postal_code: z.string(),
  city: z.string(),
  f_skatt: z.boolean(),
  accounting_method: z.enum(['invoice', 'cash']),
  payment_kind: z.enum(['bankgiro', 'plusgiro', 'iban']),
  payment_number: z.string(),
  swish: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
})

const kindJson = z.enum(['invoice', 'credit_note'])

export const manage = async (trx: Trx, userId: string, orgId: string) => {
  await require(trx, userId, orgId, 'invoices.manage')
  return actor(trx, userId)
}

// ---- Reading

const summaryColumns = [
  'invoices.id',
  'invoices.kind',
  'invoices.status',
  'invoices.number',
  'invoices.ocr',
  'invoices.credits_id',
  'invoices.customer_id',
  sql<string>`invoices.invoice_date::text`.as('invoice_date'),
  sql<string>`invoices.supply_date::text`.as('supply_date'),
  sql<string>`invoices.due_date::text`.as('due_date'),
  'invoices.reference',
  'invoices.voucher_id',
  'invoices.document_id',
  'invoices.emailed_to',
  'invoices.emailed_at',
  'invoices.created_by_name',
  'invoices.created_at',
  'invoices.sent_by_name',
  'invoices.sent_at',
] as const

// bigint columns reach Node as strings; an invoice number is small enough for a number.
export const nullable = (v: string | null) => (v === null ? null : Number(v))

export const listInvoices = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const rows = await trx
      .selectFrom('invoices')
      .leftJoin('customers', 'customers.id', 'invoices.customer_id')
      .select([
        ...summaryColumns,
        'invoices.total',
        sql<
          string | null
        >`coalesce(invoices.buyer->>'name', customers.name)`.as(
          'customer_name',
        ),
      ])
      .where('invoices.organisation_id', '=', orgId)
      .orderBy('invoices.created_at', 'desc')
      .limit(500)
      .execute()
    return rows.map((r) => ({
      ...r,
      number: nullable(r.number),
      total: nullable(r.total),
    }))
  })

// What sending will record, exactly: the lines, the VAT per rate and the totals, all from the database.
export async function readInvoice(trx: Trx, orgId: string, id: string) {
  const v = await trx
    .selectFrom('invoices')
    .select([...summaryColumns, 'invoices.buyer', 'invoices.seller'])
    .where('invoices.organisation_id', '=', orgId)
    .where('invoices.id', '=', id)
    .executeTakeFirst()
  if (!v) throw new HttpError(404, 'not_found')
  const lines = (
    await trx
      .selectFrom('invoice_lines')
      .select([
        'line_no',
        'description',
        'quantity_milli',
        'unit',
        'unit_price',
        'vat_code',
        'net',
      ])
      .where('organisation_id', '=', orgId)
      .where('invoice_id', '=', id)
      .orderBy('line_no')
      .execute()
  ).map(({ quantity_milli, unit_price, net, ...l }) => ({
    ...l,
    quantity: Number(quantity_milli) / 1000,
    unit_price: Number(unit_price),
    net: Number(net),
  }))
  const rates = (
    await sql<{
      vat_code: string
      net: string
      vat: string
    }>`select vat_code, net, vat from invoice_rates(${id})`.execute(trx)
  ).rows.map((r) => ({
    vat_code: r.vat_code,
    net: Number(r.net),
    vat: Number(r.vat),
  }))
  const net = rates.reduce((s, r) => s + r.net, 0)
  const vat = rates.reduce((s, r) => s + r.vat, 0)
  const original = v.credits_id
    ? await trx
        .selectFrom('invoices')
        .select('number')
        .where('organisation_id', '=', orgId)
        .where('id', '=', v.credits_id)
        .executeTakeFirst()
    : undefined
  const customer = v.customer_id
    ? await trx
        .selectFrom('customers')
        .select('name')
        .where('id', '=', v.customer_id)
        .executeTakeFirst()
    : undefined
  const { buyer, seller, number, ...rest } = v
  return {
    ...rest,
    kind: kindJson.parse(rest.kind),
    number: nullable(number),
    buyer: buyer === null ? null : buyerJson.parse(buyer),
    seller: seller === null ? null : sellerJson.parse(seller),
    customer_name: customer?.name ?? null,
    credits_number: nullable(original?.number ?? null),
    lines,
    rates,
    totals: { net, vat, total: net + vat },
  }
}

export const getInvoice = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return readInvoice(trx, orgId, id)
  })

export type View = Awaited<ReturnType<typeof readInvoice>>
export type Sent = Omit<View, 'number' | 'ocr' | 'buyer' | 'seller'> & {
  number: number
  ocr: string
  buyer: z.output<typeof buyerJson>
  seller: z.output<typeof sellerJson>
}
export const sent = (v: View): Sent => {
  if (v.number === null || !v.ocr || !v.buyer || !v.seller)
    throw new HttpError(409, 'not_sent')
  return {
    ...v,
    number: v.number,
    ocr: v.ocr,
    buyer: v.buyer,
    seller: v.seller,
  }
}

// The buyer and seller as they stand now, or the original's for a credit note.

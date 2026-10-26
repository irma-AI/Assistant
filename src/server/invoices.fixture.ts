import { expect } from 'vitest'
import { z } from 'zod'
import { luhn } from '#/api/company'
import { books } from './bookkeeping.fixture'
import { customersApi } from './customers.api.server'
import { documentsApi } from './documents.api.server'
import type { Mail } from './email.server'
import { invoicesApi as api } from './invoices.api.server'
import { orgsApi } from './orgs.api.server'
import { db, idOf, req } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

export const invoice = z
  .object({
    id: z.string(),
    kind: z.string(),
    status: z.string(),
    number: z.number().nullable(),
    ocr: z.string().nullable(),
    customer_id: z.string().nullable(),
    document_id: z.string().nullable(),
    voucher_id: z.string().nullable(),
    credits_number: z.number().nullable(),
    emailed_to: z.string().nullable(),
    emailed_at: z.string().nullable(),
    buyer: z.object({ name: z.string() }).loose().nullable(),
    rates: z.array(
      z.object({ vat_code: z.string(), net: z.number(), vat: z.number() }),
    ),
    totals: z.object({ net: z.number(), vat: z.number(), total: z.number() }),
  })
  .loose()
export const sendBody = z.object({ invoice, email: z.string() })

// A different valid number per call: an organisation number is unique.
let next = 556100000
export const orgNo = () => {
  next += 1
  const digits = String(next)
  const check = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) =>
    luhn(`${digits}${String(d)}`),
  )
  return `${digits}${String(check)}`
}

export const company = (method: string) => ({
  org_number: orgNo(),
  legal_name: 'Bolaget AB',
  company_form: 'ab',
  seat: 'Stockholm',
  street: 'Storgatan 1',
  postal_code: '11122',
  city: 'Stockholm',
  f_skatt: true,
  vat_period: 'quarterly',
  accounting_method: method,
  payment_kind: 'bankgiro',
  payment_number: '123-4567',
  swish: null,
  contact_email: 'info@example.com',
  contact_phone: null,
  fiscal_year_start: '2026-01-01',
  fiscal_year_end: '2026-12-31',
})

export const hours = (quantity = 10, vat_code = '25') => ({
  description: 'Konsulttimmar',
  quantity,
  unit: 'tim',
  unit_price: 100000,
  vat_code,
})
export const body = (customer: string, lines = [hours()]) => ({
  customer_id: customer,
  invoice_date: '2026-03-10',
  lines,
})

export async function setup(method = 'invoice') {
  const { owner, org } = await books()
  const saved = await orgsApi.saveCompany(
    req(owner, 'PUT', company(method)),
    org,
    db,
  )
  expect(saved.status).toBe(200)
  const customer = await idOf(
    await customersApi.create(
      req(owner, 'POST', {
        kind: 'business',
        name: 'Grannen AB',
        address: 'Vägen 2\n111 22 Stockholm',
        email: 'kund@example.com',
        org_number: '5560160680',
      }),
      org,
      db,
    ),
  )
  return { owner, org, customer: customer.id }
}

export const draft = async (p: Person, org: string, b: object) => {
  const r = await api.create(req(p, 'POST', b), org, db)
  expect(r.status).toBe(201)
  return invoice.parse(await r.json())
}
export const send = (
  p: Person,
  org: string,
  id: string,
  delivery = 'download',
  mail: (m: Mail) => Promise<void> = () => Promise.resolve(),
) => api.send(req(p, 'POST', { delivery }), org, id, db, mail)
export const sendOk = async (
  p: Person,
  org: string,
  id: string,
  delivery?: string,
) => {
  const r = await send(p, org, id, delivery)
  expect(r.status).toBe(200)
  return sendBody.parse(await r.json())
}
export const errorOf = async (r: Response) =>
  z.object({ error: z.string() }).parse(await r.json()).error
export const read = async (p: Person, org: string, id: string) =>
  invoice.parse(await (await api.get(req(p, 'GET'), org, id, db)).json())

export const lineSums = (org: string, voucher: string) =>
  inOrganisation(db, org, async (trx) =>
    Object.fromEntries(
      (
        await trx
          .selectFrom('voucher_lines')
          .select(['account', 'debit', 'credit'])
          .where('voucher_id', '=', voucher)
          .execute()
      ).map((l) => [l.account, [Number(l.debit), Number(l.credit)]]),
    ),
  )

export const pdfOf = async (
  p: Person,
  org: string,
  i: { document_id: string | null },
) => {
  const r = await documentsApi.download(
    req(p, 'GET'),
    org,
    i.document_id ?? '',
    db,
  )
  expect(r.headers.get('content-type')).toBe('application/pdf')
  return Buffer.from(await r.arrayBuffer()).toString('latin1')
}

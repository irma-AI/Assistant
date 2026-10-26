import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'kysely'
import { beforeAll, expect, test } from 'vitest'
import { customersApi } from './customers.api.server'
import type { Mail } from './email.server'
import { invoicePdf, money } from './invoicePdf.server'
import { invoicesApi as api } from './invoices.api.server'
import {
  body,
  draft,
  errorOf,
  hours,
  invoice,
  lineSums,
  pdfOf,
  read,
  send,
  sendBody,
  sendOk,
  setup,
} from './invoices.fixture'
import { db, idOf, req, useDatabase } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()
beforeAll(async () => {
  process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'invoices-'))
})

test('reverse charge needs the buyer VAT number and says so on the PDF', async () => {
  const { owner, org } = await setup()
  const eu = await idOf(
    await customersApi.create(
      req(owner, 'POST', {
        kind: 'business',
        name: 'Byggbolaget AB',
        address: 'Gatan 3',
        vat_number: 'SE556016068001',
      }),
      org,
      db,
    ),
  )
  const sent = (
    await sendOk(
      owner,
      org,
      (await draft(owner, org, body(eu.id, [hours(1, 'rc')]))).id,
    )
  ).invoice
  expect(sent.totals).toEqual({ net: 100000, vat: 0, total: 100000 })
  expect(await pdfOf(owner, org, sent)).toContain(
    'Omv\xe4nd betalningsskyldighet',
  )
})

test('under the invoice method sending books receivable, revenue and output VAT, and retains the PDF', async () => {
  const { owner, org, customer } = await setup()
  const sent = (
    await sendOk(owner, org, (await draft(owner, org, body(customer))).id)
  ).invoice
  expect(sent.voucher_id).not.toBeNull()
  expect(await lineSums(org, sent.voucher_id ?? '')).toEqual({
    '1510': [1250000, 0],
    '3001': [0, 1000000],
    '2611': [0, 250000],
  })
  const credit = invoice.parse(
    await (await api.credit(req(owner, 'POST'), org, sent.id, db)).json(),
  )
  const sentCredit = (await sendOk(owner, org, credit.id)).invoice
  expect(await lineSums(org, sentCredit.voucher_id ?? '')).toEqual({
    '1510': [0, 1250000],
    '3001': [1000000, 0],
    '2611': [250000, 0],
  })
  const retained = await inOrganisation(db, org, (trx) =>
    trx
      .selectFrom('documents')
      .select(sql<string>`retain_until::text`.as('r'))
      .where('id', '=', sent.document_id ?? '')
      .executeTakeFirstOrThrow(),
  )
  expect(retained.r).toBe('2033-12-31')
})

test('under the cash method nothing is booked yet, but the PDF is retained', async () => {
  const { owner, org, customer } = await setup('cash')
  const sent = (
    await sendOk(owner, org, (await draft(owner, org, body(customer))).id)
  ).invoice
  expect(sent.voucher_id).toBeNull()
  const doc = sent.document_id ?? ''
  await expect(
    inOrganisation(db, org, (trx) =>
      sql`delete from documents where id = ${doc}`.execute(trx),
    ),
  ).rejects.toThrow(/retained/)
})

test('the PDF carries the mandatory contents and email attaches it', async () => {
  const { owner, org, customer } = await setup()
  const mails: Mail[] = []
  const r = await send(
    owner,
    org,
    (await draft(owner, org, body(customer))).id,
    'email',
    (m) => {
      mails.push(m)
      return Promise.resolve()
    },
  )
  const { invoice: sent, email } = sendBody.parse(await r.json())
  expect(email).toBe('sent')
  expect(sent.emailed_to).toBe('kund@example.com')
  expect(sent.emailed_at).not.toBeNull()
  const pdf = await pdfOf(owner, org, sent)
  expect(pdf.startsWith('%PDF-')).toBe(true)
  for (const text of [
    'Faktura 1',
    'Bolaget AB',
    'Godk\xe4nd f\xf6r F-skatt',
    'Moms 25',
    'Grannen AB',
    '12 500,00',
    'Bankgiro: 123-4567',
    `OCR-nummer`,
    'SE',
  ])
    expect(pdf).toContain(text)
  expect(pdf).toContain(sent.ocr ?? 'missing')
  expect(mails).toHaveLength(1)
  expect(mails[0]?.to).toBe('kund@example.com')
  expect(mails[0]?.attachments?.[0]?.content.toString('latin1')).toBe(pdf)
})

test('a failed mail leaves the invoice sent and can be retried; no address refuses before sending', async () => {
  const { owner, org, customer } = await setup()
  const d = await draft(owner, org, body(customer))
  const failed = sendBody.parse(
    await (
      await send(owner, org, d.id, 'email', () =>
        Promise.reject(new Error('smtp down')),
      )
    ).json(),
  )
  expect(failed).toMatchObject({
    email: 'failed',
    invoice: { status: 'sent', emailed_at: null },
  })
  const retry = await api.email(req(owner, 'POST'), org, d.id, db, () =>
    Promise.resolve(),
  )
  expect(invoice.parse(await retry.json()).emailed_at).not.toBeNull()

  const nobody = await idOf(
    await customersApi.create(
      req(owner, 'POST', {
        kind: 'consumer',
        name: 'Utan Mejl',
        address: 'Gatan 1',
      }),
      org,
      db,
    ),
  )
  const e = await draft(owner, org, body(nobody.id))
  expect(await errorOf(await send(owner, org, e.id, 'email'))).toBe(
    'buyer_email_required',
  )
  expect((await read(owner, org, e.id)).status).toBe('draft')
})

test('the PDF writer pages long invoices and formats öre', () => {
  expect(money(123456, 'sv')).toBe('1 234,56')
  expect(money(-5, 'en')).toBe('-0.05')
  const base = {
    kind: 'invoice' as const,
    number: 1,
    ocr: '133',
    invoice_date: '2026-03-10',
    supply_date: '2026-03-10',
    due_date: '2026-04-09',
    reference: null,
    credits_number: null,
    buyer: {
      name: 'K',
      address: 'A',
      org_number: null,
      vat_number: null,
      language: 'en' as const,
    },
    seller: {
      legal_name: 'S AB',
      org_number: '5560160680',
      vat_number: 'SE556016068001',
      seat: 'Sthlm',
      street: 'G 1',
      postal_code: '11122',
      city: 'Sthlm',
      f_skatt: false,
      payment_kind: 'iban' as const,
      payment_number: 'SE00',
      swish: null,
      contact_email: null,
      contact_phone: null,
    },
    lines: Array.from({ length: 90 }, () => ({
      description: 'x',
      quantity: 1,
      unit: 'st',
      unit_price: 100,
      vat_code: '25',
      net: 100,
    })),
    rates: [{ vat_code: '25', net: 9000, vat: 2250 }],
    totals: { net: 9000, vat: 2250, total: 11250 },
  }
  const pdf = invoicePdf(base).toString('latin1')
  expect(pdf).toContain('/Count 3')
  expect(pdf).toContain('Invoice 1')
  expect(pdf).not.toContain('F-tax')
})

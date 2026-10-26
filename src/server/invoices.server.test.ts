import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'kysely'
import { beforeAll, expect, test } from 'vitest'
import { z } from 'zod'
import { luhn } from '#/api/company'
import { customersApi } from './customers.api.server'
import { invoicesApi as api } from './invoices.api.server'
import {
  body,
  draft,
  errorOf,
  hours,
  invoice,
  read,
  send,
  sendOk,
  setup,
} from './invoices.fixture'
import { addMember, db, idOf, person, req, useDatabase } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()
beforeAll(async () => {
  process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'invoices-'))
})

test('drafts are created, edited and deleted with invoices.manage; every member reads them', async () => {
  const { owner, org, customer } = await setup()
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  const d = await draft(owner, org, body(customer))
  expect(d).toMatchObject({ status: 'draft', number: null, ocr: null })
  expect(d.totals).toEqual({ net: 1000000, vat: 250000, total: 1250000 })
  expect(
    (await api.create(req(member, 'POST', body(customer)), org, db)).status,
  ).toBe(403)
  expect((await read(member, org, d.id)).id).toBe(d.id)
  const list = z
    .array(z.object({ id: z.string(), customer_name: z.string() }))
    .parse(await (await api.list(req(member, 'GET'), org, db)).json())
  expect(list).toEqual([{ id: d.id, customer_name: 'Grannen AB' }])

  const edited = await api.replaceDraft(
    req(owner, 'PUT', body(customer, [hours(2.5, '6')])),
    org,
    d.id,
    db,
  )
  expect(invoice.parse(await edited.json()).totals).toEqual({
    net: 250000,
    vat: 15000,
    total: 265000,
  })
  expect(
    (await api.deleteDraft(req(owner, 'DELETE'), org, d.id, db)).status,
  ).toBe(204)
  expect((await api.get(req(owner, 'GET'), org, d.id, db)).status).toBe(404)
})

test('the database numbers sent invoices 1, 2, 3 per organisation, with an OCR reference that passes Luhn', async () => {
  const a = await setup()
  const b = await setup()
  // A refused send takes no number.
  const rc = await draft(a.owner, a.org, body(a.customer, [hours(1, 'rc')]))
  const refused = await send(a.owner, a.org, rc.id)
  expect(refused.status).toBe(422)
  expect(await errorOf(refused)).toBe('buyer_vat_number_required')

  const first = (
    await sendOk(
      a.owner,
      a.org,
      (await draft(a.owner, a.org, body(a.customer))).id,
    )
  ).invoice
  const second = (
    await sendOk(
      a.owner,
      a.org,
      (await draft(a.owner, a.org, body(a.customer))).id,
    )
  ).invoice
  const other = (
    await sendOk(
      b.owner,
      b.org,
      (await draft(b.owner, b.org, body(b.customer))).id,
    )
  ).invoice
  expect([first.number, second.number, other.number]).toEqual([1, 2, 1])
  expect(first.ocr).toBe('133')
  for (const i of [first, second, other]) {
    const ocr = i.ocr ?? ''
    expect(luhn(ocr)).toBe(true)
    // The digit before the check digit is the reference's length modulo 10.
    expect(ocr.at(-2)).toBe(String(ocr.length % 10))
  }
})

test('a sent invoice and its lines are immutable, in the API and in the database', async () => {
  const { owner, org, customer } = await setup()
  const sent = (
    await sendOk(owner, org, (await draft(owner, org, body(customer))).id)
  ).invoice
  const put = await api.replaceDraft(
    req(owner, 'PUT', body(customer)),
    org,
    sent.id,
    db,
  )
  expect(await errorOf(put)).toBe('not_draft')
  const attempts = [
    sql`update invoices set total = 1, total_net = 1, total_vat = 0 where id = ${sent.id}`,
    sql`update invoices set number = 99 where id = ${sent.id}`,
    sql`delete from invoices where id = ${sent.id}`,
    sql`update invoice_lines set unit_price = 1 where invoice_id = ${sent.id}`,
    sql`delete from invoice_lines where invoice_id = ${sent.id}`,
    sql`insert into invoice_lines (organisation_id, invoice_id, line_no, description, quantity_milli, unit_price, vat_code)
      values (${org}::uuid, ${sent.id}::uuid, 9, 'x', 1000, 1, '25')`,
  ]
  for (const attempt of attempts)
    await expect(
      inOrganisation(db, org, (trx) => attempt.execute(trx)),
    ).rejects.toThrow(/immutable|cannot be deleted/)
})

test('VAT is rounded once per rate and the totals add up', async () => {
  const { owner, org, customer } = await setup()
  const d = await draft(
    owner,
    org,
    body(customer, [
      {
        description: 'A',
        quantity: 3,
        unit: 'st',
        unit_price: 333,
        vat_code: '25',
      },
      {
        description: 'B',
        quantity: 1.5,
        unit: 'st',
        unit_price: 1001,
        vat_code: '25',
      },
      {
        description: 'C',
        quantity: 1,
        unit: 'st',
        unit_price: 5000,
        vat_code: '0',
      },
    ]),
  )
  // 999 + 1502 (1501.5 half up) = 2501 at 25 %: VAT 625.25 -> 625. 5000 at 0 %.
  expect(d.rates).toEqual([
    { vat_code: '0', net: 5000, vat: 0 },
    { vat_code: '25', net: 2501, vat: 625 },
  ])
  expect(d.totals).toEqual({ net: 7501, vat: 625, total: 8126 })
  const sent = (await sendOk(owner, org, d.id)).invoice
  expect(sent.totals).toEqual(d.totals)
})

test('a credit note refers to the original and the database refuses credit above it', async () => {
  const { owner, org, customer } = await setup()
  const orig = await draft(owner, org, body(customer))
  const early = await api.credit(req(owner, 'POST'), org, orig.id, db)
  expect(await errorOf(early)).toBe('not_creditable')
  await sendOk(owner, org, orig.id)

  // Partial credit: 4 of 10 hours.
  const credit = invoice.parse(
    await (await api.credit(req(owner, 'POST'), org, orig.id, db)).json(),
  )
  expect(credit).toMatchObject({ kind: 'credit_note', credits_number: 1 })
  await api.replaceDraft(
    req(owner, 'PUT', { ...body(customer, [hours(4)]), customer_id: null }),
    org,
    credit.id,
    db,
  )
  const sentCredit = (await sendOk(owner, org, credit.id)).invoice
  expect(sentCredit).toMatchObject({ number: 2, totals: { total: 500000 } })
  expect(sentCredit.buyer?.name).toBe('Grannen AB')

  // A full copy now would credit 10 hours on top of 4.
  const again = invoice.parse(
    await (await api.credit(req(owner, 'POST'), org, orig.id, db)).json(),
  )
  const refused = await send(owner, org, again.id)
  expect(refused.status).toBe(422)
  expect(await errorOf(refused)).toBe('credit_exceeds')
  // The remaining 6 hours fit.
  await api.replaceDraft(
    req(owner, 'PUT', body(customer, [hours(6)])),
    org,
    again.id,
    db,
  )
  expect((await sendOk(owner, org, again.id)).invoice.number).toBe(3)
  // A credit note can't be credited.
  expect(
    (await api.credit(req(owner, 'POST'), org, credit.id, db)).status,
  ).toBe(409)
})

test('sending copies the buyer, so editing or deleting the customer changes nothing', async () => {
  const { owner, org, customer } = await setup()
  const sent = (
    await sendOk(owner, org, (await draft(owner, org, body(customer))).id)
  ).invoice
  expect(sent.buyer).toMatchObject({
    name: 'Grannen AB',
    email: 'kund@example.com',
  })
  expect(
    (await customersApi.remove(req(owner, 'DELETE'), org, customer, db)).status,
  ).toBe(204)
  const after = await read(owner, org, sent.id)
  expect(after.buyer).toEqual(sent.buyer)
  expect(after.customer_id).toBeNull()
  // A draft whose customer is gone can't be sent.
  const { customer: c2 } = {
    customer: await idOf(
      await customersApi.create(
        req(owner, 'POST', {
          kind: 'consumer',
          name: 'Test',
          address: 'Gatan 1',
        }),
        org,
        db,
      ),
    ),
  }
  const orphan = await draft(owner, org, body(c2.id))
  await customersApi.remove(req(owner, 'DELETE'), org, c2.id, db)
  expect(await errorOf(await send(owner, org, orphan.id))).toBe(
    'customer_missing',
  )
})

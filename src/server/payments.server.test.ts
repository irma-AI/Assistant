import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, expect, test } from 'vitest'
import { z } from 'zod'
import { books } from './bookkeeping.fixture'
import {
  body,
  draft,
  hours,
  invoice,
  lineSums,
  sendOk,
  setup,
} from './invoices.fixture'
import { invoicesApi } from './invoices.api.server'
import { listNotices } from './notifications.server'
import { addMember, db, person, req, useDatabase } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { paymentsApi } from './payments.api.server'
import { allocate } from './payments.settle.server'
import { watchInvoices } from './payments.watch.server'
import { suggestPayments } from './payments.suggest.server'
import { bankWith } from './receipts.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()
beforeAll(async () => {
  process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'payments-'))
})

const invoiceRow = z.object({
  id: z.string(),
  number: z.number(),
  open_ore: z.number(),
  payments: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      pass: z.number(),
      confidence: z.number(),
      covers_ore: z.number(),
      extra_ore: z.number(),
    }),
  ),
})
const list = async (p: Person, org: string) =>
  z
    .object({
      invoices: z.array(invoiceRow),
      unmatched: z.array(z.object({ id: z.string() })),
    })
    .parse(await (await paymentsApi.list(req(p, 'GET'), org, db)).json())
// The bank import runs the matching; these payments are typed in, so run it here.
const bank = async (org: string, rows: Parameters<typeof bankWith>[1]) => {
  const ids = await bankWith(org, rows)
  await inOrganisation(db, org, (t) => suggestPayments(t, org))
  return ids
}
const openOf = async (p: Person, org: string) =>
  (await list(p, org)).invoices[0]?.open_ore
const waiting = async (p: Person, org: string) =>
  (await list(p, org)).invoices[0]?.payments.find(
    (x) => x.status === 'suggested',
  )
const decide = (p: Person, org: string, id: string, verdict: string) =>
  paymentsApi.decide(req(p, 'PUT', { verdict }), org, id, db)
const vouchers = (org: string) =>
  inOrganisation(db, org, async (t) =>
    Number(
      (
        await t
          .selectFrom('vouchers')
          .select((e) => e.fn.countAll().as('n'))
          .where('organisation_id', '=', org)
          .executeTakeFirstOrThrow()
      ).n,
    ),
  )
const sentInvoice = async (
  p: Person,
  org: string,
  customer: string,
  lines = [hours()],
) =>
  (await sendOk(p, org, (await draft(p, org, body(customer, lines))).id))
    .invoice
const due = async (org: string, id: string) =>
  inOrganisation(db, org, async (t) =>
    (
      await t
        .selectFrom('invoices')
        .select('due_date')
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
    ).due_date
      .toISOString()
      .slice(0, 10),
  )
const eventTypesOf = (org: string) =>
  inOrganisation(db, org, async (t) =>
    (
      await t
        .selectFrom('notification_events')
        .select('type')
        .where('organisation_id', '=', org)
        .orderBy('created_at')
        .orderBy('id')
        .execute()
    ).map((e) => e.type),
  )

test('a payment with the invoice OCR is suggested; nothing is booked until a person confirms, then the receivable is settled', async () => {
  const { owner, org, customer } = await setup()
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  const inv = await sentInvoice(owner, org, customer)
  const before = await vouchers(org)
  const [tx] = await bank(org, [
    {
      amount: 1_250_000,
      date: '2026-03-20',
      text: 'Grannen AB',
      ref: inv.ocr ?? '',
    },
  ])

  const [row] = (await list(owner, org)).invoices
  expect(row).toMatchObject({ open_ore: 1_250_000 })
  expect(row?.payments).toMatchObject([
    { status: 'suggested', pass: 1, confidence: 0.98, covers_ore: 1_250_000 },
  ])
  expect(await vouchers(org)).toBe(before)
  expect((await list(owner, org)).unmatched).toEqual([])

  const id = row?.payments[0]?.id ?? ''
  expect((await decide(member, org, id, 'confirmed')).status).toBe(403)
  expect((await decide(owner, org, id, 'confirmed')).status).toBe(204)
  expect((await decide(owner, org, id, 'rejected')).status).toBe(409)
  expect(await vouchers(org)).toBe(before + 1)
  const settled = await inOrganisation(db, org, async (t) =>
    t
      .selectFrom('invoice_payments')
      .select('voucher_id')
      .where('bank_transaction_id', '=', tx ?? '')
      .executeTakeFirstOrThrow(),
  )
  expect(await lineSums(org, settled.voucher_id ?? '')).toEqual({
    '1930': [1_250_000, 0],
    '1510': [0, 1_250_000],
  })
  expect(await openOf(owner, org)).toBe(0)
  expect(await eventTypesOf(org)).toEqual(['invoice_paid'])
  // Only members who manage invoices see it.
  expect(await listNotices(db, owner.id, org)).toHaveLength(1)
  expect(await listNotices(db, member.id, org)).toHaveLength(0)
})

test('under the cash method confirming books revenue and VAT in the invoice proportions', async () => {
  const { owner, org, customer } = await setup('cash')
  const inv = await sentInvoice(owner, org, customer)
  expect(inv.voucher_id).toBeNull()
  await bank(org, [
    {
      amount: 500_000,
      date: '2026-03-20',
      text: 'Grannen AB',
      ref: inv.ocr ?? '',
    },
  ])
  const p = (await list(owner, org)).invoices[0]?.payments[0]
  expect(p).toMatchObject({ pass: 1, covers_ore: 500_000 })
  expect((await decide(owner, org, p?.id ?? '', 'confirmed')).status).toBe(204)
  const v = await inOrganisation(db, org, (t) =>
    t
      .selectFrom('invoice_payments')
      .select('voucher_id')
      .where('organisation_id', '=', org)
      .executeTakeFirstOrThrow(),
  )
  expect(await lineSums(org, v.voucher_id ?? '')).toEqual({
    '1930': [500_000, 0],
    '3001': [0, 400_000],
    '2611': [0, 100_000],
  })
  expect(await eventTypesOf(org)).toEqual(['invoice_part_paid'])
})

test('a part payment leaves the rest open, an overpayment is flagged and a credit note lowers the open amount', async () => {
  const { owner, org, customer } = await setup()
  const a = await sentInvoice(owner, org, customer)
  const [t1] = await bank(org, [
    { amount: 500_000, date: '2026-03-20', text: 'X', ref: a.ocr ?? '' },
  ])
  await decide(owner, org, (await waiting(owner, org))?.id ?? '', 'confirmed')
  expect(await openOf(owner, org)).toBe(750_000)

  // A 4-hour credit note (500 000 with VAT) leaves 250 000 to pay.
  const credit = invoice.parse(
    await (await invoicesApi.credit(req(owner, 'POST'), org, a.id, db)).json(),
  )
  await invoicesApi.replaceDraft(
    req(owner, 'PUT', { ...body(customer, [hours(4)]), customer_id: null }),
    org,
    credit.id,
    db,
  )
  await sendOk(owner, org, credit.id)
  expect(await openOf(owner, org)).toBe(250_000)

  // 3 000 kr arrives for the 2 500 kr left: the OCR finds it, the extra 500 kr is flagged.
  await bank(org, [
    { amount: 300_000, date: '2026-03-25', text: 'X', ref: a.ocr ?? '' },
  ])
  const second = await waiting(owner, org)
  expect(second).toMatchObject({ covers_ore: 250_000, extra_ore: 50_000 })
  expect(t1).toBeDefined()
  await decide(owner, org, second?.id ?? '', 'confirmed')
  expect(await openOf(owner, org)).toBe(0)
  expect(await eventTypesOf(org)).toEqual([
    'invoice_part_paid',
    'invoice_overpaid',
  ])
})

test('a suggestion that no longer fits is refused, and a rejected one is not made again', async () => {
  const { owner, org, customer } = await setup()
  const a = await sentInvoice(owner, org, customer)
  await bank(org, [
    { amount: 1_250_000, date: '2026-03-20', text: 'Annan', ref: a.ocr ?? '' },
  ])
  const p = (await list(owner, org)).invoices[0]?.payments[0]
  const credit = invoice.parse(
    await (await invoicesApi.credit(req(owner, 'POST'), org, a.id, db)).json(),
  )
  await sendOk(owner, org, credit.id)
  // The credit note took the whole invoice, so the suggestion has nothing to cover.
  expect((await decide(owner, org, p?.id ?? '', 'confirmed')).status).toBe(409)

  const { owner: o2, org: org2, customer: c2 } = await setup()
  const b = await sentInvoice(o2, org2, c2)
  await bank(org2, [
    { amount: 1_250_000, date: '2026-03-20', text: 'Annan', ref: b.ocr ?? '' },
  ])
  const q = (await list(o2, org2)).invoices[0]?.payments[0]
  expect((await decide(o2, org2, q?.id ?? '', 'rejected')).status).toBe(204)
  const after = await list(o2, org2)
  expect(after.invoices[0]?.payments).toEqual([])
  expect(after.unmatched).toHaveLength(1)
})

test('due tomorrow and overdue each tell the invoice managers once: the first day, then weekly', async () => {
  const { owner, org, customer } = await setup()
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  const inv = await sentInvoice(owner, org, customer)
  const date = await due(org, inv.id)
  const on = (offset: number) =>
    new Date(Date.parse(date) + offset * 86_400_000).toISOString().slice(0, 10)

  await watchInvoices(db, on(-2))
  expect(await eventTypesOf(org)).toEqual([])
  await watchInvoices(db, on(-1))
  await watchInvoices(db, on(-1))
  expect(await eventTypesOf(org)).toEqual(['invoice_due_soon'])
  await watchInvoices(db, on(0))
  expect(await eventTypesOf(org)).toEqual(['invoice_due_soon'])
  await watchInvoices(db, on(1))
  await watchInvoices(db, on(4))
  await watchInvoices(db, on(7))
  expect(await eventTypesOf(org)).toEqual([
    'invoice_due_soon',
    'invoice_overdue',
  ])
  await watchInvoices(db, on(8))
  await watchInvoices(db, on(8))
  expect(await eventTypesOf(org)).toEqual([
    'invoice_due_soon',
    'invoice_overdue',
    'invoice_overdue',
  ])
  expect(await listNotices(db, owner.id, org)).toHaveLength(3)
  expect(await listNotices(db, member.id, org)).toHaveLength(0)

  // Paid: nothing more is said.
  await bank(org, [
    { amount: 1_250_000, date: on(9), text: 'X', ref: inv.ocr ?? '' },
  ])
  const p = (await list(owner, org)).invoices[0]?.payments[0]
  await decide(owner, org, p?.id ?? '', 'confirmed')
  await watchInvoices(db, on(15))
  expect(await eventTypesOf(org)).toHaveLength(4)
})

test('books() alone makes no payments', async () => {
  const { owner, org } = await books()
  expect(await list(owner, org)).toEqual({ invoices: [], unmatched: [] })
})

test('a split of a payment always adds up to the payment', () => {
  for (const paid of [1, 7, 333_333, 1_249_999, 1_250_000])
    expect(
      allocate([1_000_000, 250_000, 3], paid).reduce((s, n) => s + n, 0),
    ).toBe(paid)
  expect(allocate([1_000_000, 250_000], 500_000)).toEqual([400_000, 100_000])
})

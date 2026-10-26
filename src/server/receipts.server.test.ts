import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'kysely'
import { beforeAll, expect, test } from 'vitest'
import { bookkeepingApi } from './bookkeeping.api.server'
import { books, draft, id as idOnly, post } from './bookkeeping.fixture'
import { receiptsApi } from './receipts.api.server'
import { bankWith, fill, list, unmatched, upload } from './receipts.fixture'
import { addMember, db, newOrg, person, req, useDatabase } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()
beforeAll(async () => {
  process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'receipts-'))
})

test('a member uploads and fills in a receipt; a passing amount within the credit period is suggested with its reason, and confirming needs bookkeeping.manage', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  const [t1, t2] = await bankWith(org, [
    { amount: -12500, date: '2026-03-10', text: 'Okänd' },
    { amount: -9900, date: '2026-03-11', text: 'Annan' },
  ])
  const r = await upload(member, org)
  expect(
    (
      await fill(member, org, r.id, {
        amount_ore: 12500,
        receipt_date: '2026-03-01',
      })
    ).status,
  ).toBe(204)

  const [row] = await list(member, org)
  expect(row?.matches).toMatchObject([
    {
      status: 'suggested',
      pass: 3,
      confidence: 0.85,
      covers_ore: 12500,
      transaction: { id: t1 },
    },
  ])
  expect(await unmatched(member, org)).toHaveLength(2)

  const m = row?.matches[0]?.id ?? ''
  const put = (p: Person, verdict: string) =>
    receiptsApi.decide(req(p, 'PUT', { verdict }), org, m, db)
  expect((await put(member, 'confirmed')).status).toBe(403)
  expect((await put(owner, 'confirmed')).status).toBe(204)
  expect((await put(owner, 'rejected')).status).toBe(409)
  expect((await list(owner, org))[0]?.matches[0]?.status).toBe('confirmed')
  expect((await unmatched(owner, org)).map((t) => t.id)).toEqual([t2])
})

test('a rejected suggestion is not made again, and the switch turns suggestions off', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  await bankWith(org, [{ amount: -5000, date: '2026-03-05', text: 'Okänd' }])
  const set = (suggestions: boolean) =>
    receiptsApi.setSettings(req(owner, 'PUT', { suggestions }), org, db)
  expect((await set(false)).status).toBe(204)
  const r = await upload(owner, org)
  await fill(owner, org, r.id, { amount_ore: 5000, receipt_date: '2026-03-01' })
  expect((await list(owner, org))[0]?.matches).toEqual([])
  await set(true)
  const [row] = await list(owner, org)
  expect(row?.matches).toHaveLength(1)
  await receiptsApi.decide(
    req(owner, 'PUT', { verdict: 'rejected' }),
    org,
    row?.matches[0]?.id ?? '',
    db,
  )
  await fill(owner, org, r.id, { supplier: 'Nytt namn' })
  expect((await list(owner, org))[0]?.matches).toEqual([])
})

test('a correction links another transaction and is remembered for the supplier', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const [, odd] = await bankWith(org, [
    { amount: -4000, date: '2026-03-02', text: 'Kortköp 1' },
    { amount: -4100, date: '2026-09-02', text: 'KORT SE 4411' },
  ])
  const first = await upload(owner, org)
  await fill(owner, org, first.id, {
    supplier: 'Exempelverkstad',
    amount_ore: 4100,
    receipt_date: '2026-09-30',
  })
  // The amount is within 5 kr of both, but nothing names the supplier: no suggestion.
  expect((await list(owner, org))[0]?.matches).toEqual([])
  const link = await receiptsApi.link(
    req(owner, 'POST', { transactionId: odd }),
    org,
    first.id,
    db,
  )
  expect(link.status).toBe(201)
  expect((await list(owner, org))[0]?.matches).toMatchObject([
    { status: 'confirmed', pass: null, covers_ore: 4100 },
  ])
  // The next receipt from the same supplier now finds that bank text.
  const [again] = await bankWith(org, [
    { amount: -2000, date: '2026-10-01', text: 'KORT SE 4411' },
  ])
  const second = await upload(owner, org)
  await fill(owner, org, second.id, {
    supplier: 'Exempelverkstad',
    amount_ore: 2000,
    receipt_date: '2026-01-01',
  })
  const rows = await list(owner, org)
  expect(rows.find((x) => x.id === second.id)?.matches).toMatchObject([
    { status: 'suggested', pass: 4, transaction: { id: again } },
  ])
})

test('several receipts cover one transaction as long as the sums agree', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const [tx] = await bankWith(org, [
    { amount: -10000, date: '2026-03-05', text: 'Okänd' },
  ])
  const a = await upload(owner, org)
  const b = await upload(owner, org)
  const c = await upload(owner, org)
  await fill(owner, org, a.id, { amount_ore: 6000 })
  await fill(owner, org, b.id, { amount_ore: 4000 })
  await fill(owner, org, c.id, { amount_ore: 500 })
  const link = (r: string, coversOre?: number) =>
    receiptsApi.link(
      req(owner, 'POST', { transactionId: tx, coversOre }),
      org,
      r,
      db,
    )
  expect((await link(a.id)).status).toBe(201)
  expect((await unmatched(owner, org)).map((t) => t.id)).toEqual([tx])
  expect((await link(b.id)).status).toBe(201)
  expect(await unmatched(owner, org)).toEqual([])
  expect((await link(c.id)).status).toBe(409)
})

test('the suggested account is what the supplier was booked to before', async () => {
  const { owner, org, year } = await books()
  const first = await upload(owner, org)
  await fill(owner, org, first.id, {
    supplier: 'Exempelkafé AB',
    amount_ore: 5000,
  })
  const v = idOnly.parse(
    await (
      await bookkeepingApi.createVoucher(
        req(
          owner,
          'POST',
          draft('2026-03-10', [
            { account: '5460', debit: 5000, credit: 0 },
            { account: '1930', debit: 0, credit: 5000 },
          ]),
        ),
        org,
        db,
      )
    ).json(),
  )
  const doc = await inOrganisation(db, org, (t) =>
    t
      .selectFrom('receipts')
      .select('document_id')
      .where('id', '=', first.id)
      .executeTakeFirstOrThrow(),
  )
  await inOrganisation(db, org, (t) =>
    sql`insert into voucher_documents (organisation_id, voucher_id, document_id) values (${org}, ${v.id}, ${doc.document_id})`.execute(
      t,
    ),
  )
  expect((await post(owner, org, v.id)).status).toBe(200)
  expect(year).toBeTruthy()
  const second = await upload(owner, org)
  await fill(owner, org, second.id, { supplier: ' exempelkafé ab ' })
  const rows = await list(owner, org)
  expect(rows.find((r) => r.id === second.id)?.suggested_account).toMatchObject(
    { number: '5460' },
  )
})

test('another organisation sees nothing', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  await upload(owner, org)
  const stranger = await person()
  expect((await receiptsApi.list(req(stranger, 'GET'), org, db)).status).toBe(
    404,
  )
})

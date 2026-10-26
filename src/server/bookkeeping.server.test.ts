import { sql } from 'kysely'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { bookkeepingApi as api } from './bookkeeping.api.server'
import {
  booked,
  books,
  draft,
  newDraft,
  post,
  raw,
} from './bookkeeping.fixture'
import { addMember, db, newOrg, person, req, useDatabase } from './orgs.fixture'

useDatabase()

test('the first fiscal year seeds the BAS chart and logs it; years never overlap or exceed 18 months', async () => {
  const { owner, org } = await books()
  const accounts = z
    .array(
      z.object({ number: z.string(), name: z.string(), not_k2: z.boolean() }),
    )
    .parse(await (await api.accounts(req(owner, 'GET'), org, db)).json())
  expect(accounts).toHaveLength(1282)
  expect(accounts.filter((a) => a.not_k2)).toHaveLength(26)
  expect(accounts.find((a) => a.number === '2087')?.name).toBe(
    'Bunden överkursfond',
  )
  const hist = await raw(org, (t) =>
    t
      .selectFrom('bookkeeping_history')
      .select(['event', 'detail'])
      .where('organisation_id', '=', org)
      .orderBy('id')
      .execute(),
  )
  expect(hist.map((h) => h.event)).toEqual([
    'fiscal_year_created',
    'chart_seeded',
  ])
  expect(hist.at(1)?.detail).toMatchObject({
    bas_version: '2026-v1.1',
    accounts: 1282,
  })
  const year = (s: string, e: string) =>
    api.createYear(req(owner, 'POST', { starts_on: s, ends_on: e }), org, db)
  expect((await year('2026-06-01', '2027-05-31')).status).toBe(409)
  expect((await year('2027-01-01', '2028-07-01')).status).toBe(400) // over 18 months
  expect((await year('2027-01-01', '2028-05-31')).status).toBe(201) // 17 months, e.g. a changed year
})

test('a period lock stops postings dated inside it, and only moves forward', async () => {
  const { owner, org, year } = await books()
  const lock = (d: string) =>
    api.lockYear(req(owner, 'PATCH', { locked_through: d }), org, year, db)
  expect((await lock('2026-03-31')).status).toBe(200)
  const d = await newDraft(owner, org, draft('2026-03-31'))
  const r = await post(owner, org, d.id)
  expect(r.status).toBe(409)
  expect(await r.json()).toEqual({ error: 'period_locked' })
  expect(await booked(owner, org, draft('2026-04-01'))).toMatchObject({
    number: 1,
  })
  expect((await lock('2026-02-28')).status).toBe(409)
  expect((await lock('2027-01-01')).status).toBe(400)
  // A voucher outside every fiscal year has no home.
  const out = await api.createVoucher(
    req(owner, 'POST', draft('2025-12-31')),
    org,
    db,
  )
  expect(await out.json()).toEqual({ error: 'no_fiscal_year' })
})

test('the processing history records who, when and which version, and cannot be changed', async () => {
  const { owner, org } = await books()
  const a = await booked(owner, org)
  const h = await raw(org, (t) =>
    t
      .selectFrom('bookkeeping_history')
      .selectAll()
      .where('organisation_id', '=', org)
      .where('event', '=', 'voucher_posted')
      .execute(),
  )
  expect(h).toHaveLength(1)
  expect(h[0]).toMatchObject({
    voucher_id: a.id,
    user_id: owner.id,
    user_name: 'Test Person',
    app_version: 'dev',
  })
  await expect(
    raw(org, (t) => sql`update bookkeeping_history set event = 'x'`.execute(t)),
  ).rejects.toThrow(/append-only/)
  await expect(
    raw(org, (t) => sql`delete from bookkeeping_history`.execute(t)),
  ).rejects.toThrow(/append-only/)
})

test('members read the books, only bookkeeping.manage changes them, and other organisations see nothing', async () => {
  const { owner, org } = await books()
  const a = await booked(owner, org)
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  expect((await api.voucher(req(member, 'GET'), org, a.id, db)).status).toBe(
    200,
  )
  expect((await api.vouchers(req(member, 'GET'), org, db)).status).toBe(200)
  expect(
    (await api.createVoucher(req(member, 'POST', draft()), org, db)).status,
  ).toBe(403)
  expect((await api.post(req(member, 'POST'), org, a.id, db)).status).toBe(403)
  expect(
    (
      await api.createYear(
        req(member, 'POST', { starts_on: '2030-01-01', ends_on: '2030-12-31' }),
        org,
        db,
      )
    ).status,
  ).toBe(403)
  const stranger = await person()
  const theirs = (await newOrg(stranger)).id
  expect(
    (await api.voucher(req(stranger, 'GET'), theirs, a.id, db)).status,
  ).toBe(404)
  expect((await api.voucher(req(stranger, 'GET'), org, a.id, db)).status).toBe(
    404,
  )
  expect(
    await (await api.vouchers(req(stranger, 'GET'), theirs, db)).json(),
  ).toEqual([])
})

// The app's login owns nothing and bypasses nothing; the guard functions and the series row still work for it.

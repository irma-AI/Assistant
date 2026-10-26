import { sql } from 'kysely'
import { expect, test } from 'vitest'
import { bookkeepingApi as api } from './bookkeeping.api.server'
import {
  booked,
  books,
  draft,
  lines,
  newDraft,
  post,
  raw,
  voucher,
} from './bookkeeping.fixture'
import { db, req, useDatabase } from './orgs.fixture'

useDatabase()

test('Bokför numbers vouchers 1, 2, 3 per fiscal year, and each freezes', async () => {
  const { owner, org, year } = await books()
  const a = await booked(owner, org)
  const b = await booked(owner, org)
  expect([a.number, b.number]).toEqual([1, 2])
  expect(a.status).toBe('posted')
  // A draft has no number and can still be edited or deleted.
  const d = await newDraft(owner, org)
  expect(d.number).toBeNull()
  const edited = await api.replaceDraft(
    req(owner, 'PUT', draft('2026-03-11', lines(900))),
    org,
    d.id,
    db,
  )
  expect(edited.status).toBe(200)
  expect(
    (await api.deleteDraft(req(owner, 'DELETE'), org, d.id, db)).status,
  ).toBe(204)
  // A posted voucher takes no edit and no delete, from the API or from SQL.
  expect(
    (await api.replaceDraft(req(owner, 'PUT', draft()), org, a.id, db)).status,
  ).toBe(409)
  expect(
    (await api.deleteDraft(req(owner, 'DELETE'), org, a.id, db)).status,
  ).toBe(409)
  await expect(
    raw(org, (t) =>
      sql`update vouchers set description = 'x' where id = ${a.id}`.execute(t),
    ),
  ).rejects.toThrow(/immutable/)
  await expect(
    raw(org, (t) => sql`delete from vouchers where id = ${a.id}`.execute(t)),
  ).rejects.toThrow(/cannot be deleted/)
  await expect(
    raw(org, (t) =>
      sql`update voucher_lines set debit = 1, credit = 0 where voucher_id = ${a.id}`.execute(
        t,
      ),
    ),
  ).rejects.toThrow(/immutable/)
  await expect(
    raw(org, (t) =>
      sql`delete from voucher_lines where voucher_id = ${a.id}`.execute(t),
    ),
  ).rejects.toThrow(/immutable/)
  // The number is the database's: a number sent along is ignored, and numbers have no gaps.
  const rows = await raw(org, (t) =>
    t
      .selectFrom('vouchers')
      .select('number')
      .where('fiscal_year_id', '=', year)
      .where('number', 'is not', null)
      .orderBy('number')
      .execute(),
  )
  expect(rows.map((r) => Number(r.number))).toEqual([1, 2])
})

test('a rolled-back posting gives its number back', async () => {
  const { owner, org } = await books()
  const d = await newDraft(owner, org)
  await expect(
    raw(org, async (t) => {
      await sql`update vouchers set status = 'posted', number = 99, posted_by = created_by,
        posted_by_name = created_by_name, app_version = 'x' where id = ${d.id}`.execute(
        t,
      )
      throw new Error('boom')
    }),
  ).rejects.toThrow('boom')
  const v = await post(owner, org, d.id)
  expect(voucher.parse(await v.json()).number).toBe(1)
})

test('an unbalanced voucher cannot be booked, in the API or in the database', async () => {
  const { owner, org } = await books()
  const d = await newDraft(
    owner,
    org,
    draft('2026-03-10', [{ account: '1930', debit: 100, credit: 0 }]),
  )
  expect(d.totals.balanced).toBe(false)
  const r = await post(owner, org, d.id)
  expect(r.status).toBe(422)
  expect(await r.json()).toEqual({ error: 'unbalanced' })
  // The deferred constraint is the backstop when the check is skipped.
  await expect(
    raw(org, (t) =>
      sql`update vouchers set status = 'posted', posted_by = created_by,
      posted_by_name = created_by_name, app_version = 'x' where id = ${d.id}`.execute(
        t,
      ),
    ),
  ).rejects.toThrow(/not balanced/)
  const bad = await api.createVoucher(
    req(
      owner,
      'POST',
      draft('2026-03-10', [
        { account: '1930', debit: 1, credit: 1 },
        { account: '3001', debit: 0, credit: 0 },
      ]),
    ),
    org,
    db,
  )
  expect(bad.status).toBe(400)
  const unknown = await api.createVoucher(
    req(
      owner,
      'POST',
      draft('2026-03-10', [
        { account: '1930', debit: 5, credit: 0 },
        { account: '4999', debit: 0, credit: 5 },
      ]),
    ),
    org,
    db,
  )
  expect(unknown.status).toBe(422)
})

test('storno posts a mirror voucher, marks the original reversed and cannot be repeated', async () => {
  const { owner, org } = await books()
  const a = await booked(owner, org)
  const r = await api.reverse(
    req(owner, 'POST', { voucher_date: '2026-04-01' }),
    org,
    a.id,
    db,
  )
  expect(r.status).toBe(201)
  const s = voucher.parse(await r.json())
  expect(s).toMatchObject({ status: 'posted', number: 2, reverses_id: a.id })
  const orig = voucher.parse(
    await (await api.voucher(req(owner, 'GET'), org, a.id, db)).json(),
  )
  expect(orig.status).toBe('reversed')
  expect(orig.reversed_by?.number).toBe(2)
  const net = await raw(org, (t) =>
    sql<{
      n: string
    }>`select sum(debit - credit)::text as n from voucher_lines where organisation_id = ${org}`.execute(
      t,
    ),
  )
  expect(net.rows.at(0)?.n).toBe('0')
  expect(
    (await api.reverse(req(owner, 'POST', {}), org, a.id, db)).status,
  ).toBe(409)
  expect(
    (await api.reverse(req(owner, 'POST', {}), org, s.id, db)).status,
  ).toBe(409)
  // "Reversed" cannot be set by hand without a storno behind it.
  const b = await booked(owner, org)
  await expect(
    raw(org, (t) =>
      sql`update vouchers set status = 'reversed' where id = ${b.id}`.execute(
        t,
      ),
    ),
  ).rejects.toThrow(/immutable/)
})

test('underlag: one voucher each, retained from posting, immutable after', async () => {
  const { owner, org } = await books()
  const doc = await raw(org, (t) =>
    t
      .insertInto('documents')
      .values({
        organisation_id: org,
        name: 'kvitto.pdf',
        content_type: 'application/pdf',
        size_bytes: 10,
        sha256: 'a'.repeat(64),
        storage_key: `${org}/${crypto.randomUUID()}`,
      })
      .returning('id')
      .executeTakeFirstOrThrow(),
  )
  const d = await newDraft(owner, org)
  const attach = (v: string) =>
    api.attach(req(owner, 'POST', { document_id: doc.id }), org, v, db)
  expect((await attach(d.id)).status).toBe(201)
  const other = await newDraft(owner, org)
  expect((await attach(other.id)).status).toBe(409)
  await post(owner, org, d.id)
  const kept = await raw(org, (t) =>
    t
      .selectFrom('documents')
      .select(sql<string>`retain_until::text`.as('r'))
      .where('id', '=', doc.id)
      .executeTakeFirstOrThrow(),
  )
  expect(kept.r).toBe('2033-12-31') // 31 December of the seventh year after 2026
  await expect(
    raw(org, (t) =>
      sql`update documents set name = 'x' where id = ${doc.id}`.execute(t),
    ),
  ).rejects.toThrow(/immutable/)
  await expect(
    raw(org, (t) =>
      sql`delete from voucher_documents where voucher_id = ${d.id}`.execute(t),
    ),
  ).rejects.toThrow(/immutable/)
  const third = await newDraft(owner, org)
  expect((await attach(third.id)).status).toBe(409)
})

test('posting works under the assistant_app role, which cannot touch the series row', async () => {
  const { owner, org, year } = await books()
  const v = await newDraft(owner, org)
  const number = await raw(org, async (t) => {
    await sql`set local role assistant_app`.execute(t)
    await sql`update vouchers set status = 'posted', posted_by = created_by, posted_by_name = created_by_name,
      app_version = 'x' where id = ${v.id}`.execute(t)
    return (
      await sql<{
        number: string
      }>`select number::text from vouchers where id = ${v.id}`.execute(t)
    ).rows.at(0)?.number
  })
  expect(number).toBe('1')
  await expect(
    raw(org, async (t) => {
      await sql`set local role assistant_app`.execute(t)
      await sql`update voucher_counters set last_number = 1 where fiscal_year_id = ${year}`.execute(
        t,
      )
    }),
  ).rejects.toThrow(/permission denied/)
})

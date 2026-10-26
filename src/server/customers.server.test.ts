import { sql } from 'kysely'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { importResult } from '#/api/schemas'
import { customersApi } from './customers.api.server'
import {
  addMember,
  db,
  idOf,
  newOrg,
  person,
  req,
  useDatabase,
} from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()

const business = {
  kind: 'business',
  name: 'Grannen AB',
  address: 'Storgatan 1, 111 22 Stockholm',
  org_number: '556016-0680',
}
const consumer = { kind: 'consumer', name: 'Test Kund', address: 'Vägen 2' }

const list = async (p: Person, org: string) =>
  z
    .array(z.object({ id: z.string(), name: z.string() }).loose())
    .parse(await (await customersApi.list(req(p, 'GET'), org, db)).json())
const add = (p: Person, org: string, body: object) =>
  customersApi.create(req(p, 'POST', body), org, db)

async function setup() {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  return { owner, org, member }
}

test('an Ägare adds a business and a consumer, edits and deletes them; members may only read', async () => {
  const { owner, org, member } = await setup()
  const b = await idOf(await add(owner, org, business))
  expect((await add(owner, org, consumer)).status).toBe(201)
  const rows = z
    .array(z.object({ name: z.string() }).loose())
    .parse(await (await customersApi.list(req(member, 'GET'), org, db)).json())
  expect(rows.map((r) => r.name)).toEqual(['Grannen AB', 'Test Kund'])

  const edit = { ...business, name: 'Grannen Holding AB', language: 'en' }
  expect(
    (await customersApi.update(req(owner, 'PUT', edit), org, b.id, db)).status,
  ).toBe(204)
  expect((await list(owner, org)).map((r) => r.name)).toContain(
    'Grannen Holding AB',
  )

  // A member without customers.manage is refused on every change.
  for (const r of [
    await add(member, org, business),
    await customersApi.update(req(member, 'PUT', edit), org, b.id, db),
    await customersApi.remove(req(member, 'DELETE'), org, b.id, db),
    await customersApi.import(
      req(member, 'POST', { csv: 'a\nb', mapping: {}, commit: true }),
      org,
      db,
    ),
  ])
    expect(r.status).toBe(403)

  expect(
    (await customersApi.remove(req(owner, 'DELETE'), org, b.id, db)).status,
  ).toBe(204)
  expect(await list(owner, org)).toHaveLength(1)
})

test('a non-member gets 404', async () => {
  const { org } = await setup()
  const stranger = await person()
  expect((await customersApi.list(req(stranger, 'GET'), org, db)).status).toBe(
    404,
  )
  expect((await add(stranger, org, business)).status).toBe(404)
})

test("another organisation's customers are never listed, edited or deleted, and RLS hides them", async () => {
  const a = await setup()
  const b = await setup()
  const mine = await idOf(await add(a.owner, a.org, business))
  await add(b.owner, b.org, consumer)
  expect(await list(a.owner, a.org)).toHaveLength(1)
  // Owner of B, naming A's customer under B's organisation.
  expect(
    (
      await customersApi.update(
        req(b.owner, 'PUT', business),
        b.org,
        mine.id,
        db,
      )
    ).status,
  ).toBe(404)
  expect(
    (await customersApi.remove(req(b.owner, 'DELETE'), b.org, mine.id, db))
      .status,
  ).toBe(404)
  // Owner of B against A's organisation path.
  expect((await customersApi.list(req(b.owner, 'GET'), a.org, db)).status).toBe(
    404,
  )

  // The restricted role sees only the organisation set for the transaction, and nothing without one.
  const count = (org: string | null) =>
    db.transaction().execute(async (trx) => {
      if (org)
        await sql`select set_config('app.organisation_id', ${org}, true)`.execute(
          trx,
        )
      await sql`set local role assistant_app`.execute(trx)
      const { rows } = await sql<{
        n: string
      }>`select count(*) as n from customers`.execute(trx)
      return rows[0]?.n
    })
  expect(await count(a.org)).toBe('1')
  expect(await count(null)).toBe('0')
  await expect(
    inOrganisation(db, a.org, async (trx) => {
      await sql`set local role assistant_app`.execute(trx)
      await sql`insert into customers (organisation_id, kind, name, address, payment_terms_days) values (${b.org}, 'business', 'x', 'y', 30)`.execute(
        trx,
      )
    }),
  ).rejects.toThrow(/row-level security/)
})

test('defaults, consumer limits and no personnummer', async () => {
  const { owner, org } = await setup()
  await add(owner, org, business)
  const [row] = await db
    .selectFrom('customers')
    .selectAll()
    .where('organisation_id', '=', org)
    .execute()
  expect(row).toMatchObject({
    language: 'sv',
    payment_terms_days: 30,
    org_number: '556016-0680',
  })
  expect(Object.keys(row ?? {}).join()).not.toMatch(/personn|pnr|ssn/)
  // A consumer can't hold business fields, in the API or in the database.
  expect(
    (await add(owner, org, { ...consumer, org_number: '556016-0680' })).status,
  ).toBe(400)
  expect(
    (await add(owner, org, { ...consumer, vat_number: 'SE556016068001' }))
      .status,
  ).toBe(400)
  expect(
    (await add(owner, org, { ...business, org_number: '123' })).status,
  ).toBe(400)
  await expect(
    sql`insert into customers (organisation_id, kind, name, address, contact) values (${org}, 'consumer', 'x', 'y', 'z')`.execute(
      db,
    ),
  ).rejects.toThrow(/check/)
})

test('changes and imports are audited without the customer name', async () => {
  const { owner, org } = await setup()
  const c = await idOf(await add(owner, org, business))
  await customersApi.update(req(owner, 'PUT', business), org, c.id, db)
  await customersApi.remove(req(owner, 'DELETE'), org, c.id, db)
  await customersApi.import(
    req(owner, 'POST', {
      csv: 'namn,adress\nA,B',
      mapping: { name: 'namn', address: 'adress' },
      commit: true,
    }),
    org,
    db,
  )
  const { rows } = await sql<{
    event: string
    detail: unknown
  }>`select event, detail from audit_events where detail->>'organisation' = ${org} order by id`.execute(
    db,
  )
  const ours = rows.filter((r) => r.event.startsWith('customer'))
  expect(ours.map((r) => r.event)).toEqual([
    'customer_created',
    'customer_updated',
    'customer_deleted',
    'customers_imported',
  ])
  expect(JSON.stringify(ours)).not.toContain('Grannen')
})

const importCsv = async (
  p: Person,
  org: string,
  csv: string,
  commit: boolean,
) =>
  importResult.parse(
    await (
      await customersApi.import(
        req(p, 'POST', {
          csv,
          commit,
          mapping: {
            kind: 'typ',
            name: 'namn',
            address: 'adress',
            email: 'epost',
            org_number: 'orgnr',
          },
        }),
        org,
        db,
      )
    ).json(),
  )

test('an import checks every row and saves nothing unless all are valid', async () => {
  const { owner, org } = await setup()
  const header = 'typ;namn;adress;epost;orgnr'
  const good = [
    '"Företag";"Ek & Co, AB";"Gatan 1";info@ek.example;556016-0680',
    'privat;Anna;Vägen 3;;',
  ]
  const bad = 'privat;;Vägen 4;inte-en-epost;'

  // Preview: nothing is saved.
  const preview = await importCsv(
    owner,
    org,
    [header, ...good].join('\r\n'),
    false,
  )
  expect(preview).toEqual({ rows: 2, errors: [], saved: false })
  expect(await list(owner, org)).toHaveLength(0)

  // One bad row: reported with its line, and the good rows are not half-imported.
  const failed = await importCsv(
    owner,
    org,
    [header, ...good, bad].join('\n'),
    true,
  )
  expect(failed.saved).toBe(false)
  expect(failed.errors).toEqual([{ row: 4, fields: ['name', 'email'] }])
  expect(await list(owner, org)).toHaveLength(0)

  const saved = await importCsv(owner, org, [header, ...good].join('\n'), true)
  expect(saved.saved).toBe(true)
  expect((await list(owner, org)).map((r) => r.name)).toEqual([
    'Anna',
    'Ek & Co, AB',
  ])
})

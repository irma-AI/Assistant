import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { beforeAll, expect, test } from 'vitest'
import { db, useDatabase } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()
beforeAll(setup)

const a = randomUUID()
const b = randomUUID()

// A scratch tenant table with the policy every tenant table gets. The test owns it, so FORCE is what binds the owner;
// SET LOCAL ROLE then makes the transaction the restricted role the app logs in as.
async function setup() {
  await sql`create table scratch (id serial primary key, organisation_id uuid not null, note text)`.execute(
    db,
  )
  await sql`alter table scratch enable row level security`.execute(db)
  await sql`alter table scratch force row level security`.execute(db)
  await sql`create policy tenant on scratch using (organisation_id = current_organisation_id()) with check (organisation_id = current_organisation_id())`.execute(
    db,
  )
  await sql`grant select, insert on scratch to assistant_app`.execute(db)
  await sql`grant usage on sequence scratch_id_seq to assistant_app`.execute(db)
  await sql`insert into scratch (organisation_id, note) values (${a}, 'a'), (${b}, 'b')`.execute(
    db,
  )
}

const asApp = <T>(org: string, fn: (q: typeof db) => Promise<T>) =>
  inOrganisation(db, org, async (trx) => {
    await sql`set local role assistant_app`.execute(trx)
    return fn(trx)
  })

test('the app role cannot bypass row level security', async () => {
  const { rows } = await sql<{
    rolsuper: boolean
    rolbypassrls: boolean
  }>`select rolsuper, rolbypassrls from pg_roles where rolname = 'assistant_app'`.execute(
    db,
  )
  expect(rows).toEqual([{ rolsuper: false, rolbypassrls: false }])
})

test('a transaction sees only its organisation, and without one sees nothing', async () => {
  const notes = (q: typeof db) =>
    sql<{ note: string }>`select note from scratch`
      .execute(q)
      .then((r) => r.rows.map((x) => x.note))
  expect(await asApp(a, notes)).toEqual(['a'])
  expect(await asApp(b, notes)).toEqual(['b'])
  // No setting: fail closed.
  const none = await db.transaction().execute(async (trx) => {
    await sql`set local role assistant_app`.execute(trx)
    return notes(trx)
  })
  expect(none).toEqual([])
  // The setting ended with its transaction.
  const { rows } = await sql<{
    v: string | null
  }>`select current_setting('app.organisation_id', true) as v`.execute(db)
  expect(rows[0]?.v ?? '').toBe('')
})

test("writing another organisation's row fails", async () => {
  await expect(
    asApp(a, (q) =>
      sql`insert into scratch (organisation_id, note) values (${b}, 'x')`
        .execute(q)
        .then(() => undefined),
    ),
  ).rejects.toThrow(/row-level security/)
})

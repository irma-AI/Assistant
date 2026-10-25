import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { z } from 'zod'
import { afterAll, beforeAll } from 'vitest'
import { createDb } from './db.server'
import { migrate } from './migrate.server'
import { orgsApi } from './orgs.api.server'
import { addMember as add } from './members.server'
import { createSession } from './session.server'

const name = `test_${randomUUID().replaceAll('-', '')}`
const adminUrl = () => process.env.DATABASE_URL ?? ''
export const testUrl = () => {
  const url = new URL(adminUrl())
  url.pathname = `/${name}`
  return url.href
}
export const db = createDb(testUrl())

// Call once at the top of a test file: one fresh, migrated database per file.
export function useDatabase() {
  const admin = new pg.Pool({ connectionString: adminUrl() })
  beforeAll(async () => {
    await admin.query(`create database ${name}`)
    await migrate(db)
  })
  afterAll(async () => {
    await db.destroy()
    await admin.query(`drop database ${name}`)
    await admin.end()
  })
}

export type Person = { id: string; token: string }
export const person = async (): Promise<Person> => {
  const u = await db
    .insertInto('users')
    .values({ name: 'Test Person' })
    .returning('id')
    .executeTakeFirstOrThrow()
  return { id: u.id, token: await createSession(db, u.id, 'web') }
}

export const req = (p: Person | undefined, method: string, body?: object) =>
  new Request('https://api.test/api/v1/x', {
    method,
    headers: p ? { authorization: `Bearer ${p.token}` } : {},
    body: body ? JSON.stringify(body) : undefined,
  })

const read =
  <T extends z.ZodType>(schema: T) =>
  async (r: Response) =>
    schema.parse(await r.json())
export const idOf = read(z.object({ id: z.string() }))
export const meOf = read(
  z.object({
    role: z.object({ name: z.string() }),
    permissions: z.array(z.string()),
  }),
)
export const rolesOf = read(
  z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      permissions: z.array(z.string()),
    }),
  ),
)

export const newOrg = async (owner: Person) =>
  idOf(await orgsApi.create(req(owner, 'POST', { name: 'Bolaget AB' }), db))
export const roles = async (p: Person, org: string) =>
  rolesOf(await orgsApi.roles(req(p, 'GET'), org, db))
export const roleId = async (p: Person, org: string, n: string) =>
  (await roles(p, org)).find((r) => r.name === n)?.id ?? ''
export const addMember = async (
  owner: Person,
  org: string,
  p: Person,
  role: string,
) => {
  await add(db, owner.id, org, p.id, await roleId(owner, org, role), {})
}
export const change = (
  a: Person,
  org: string,
  m: Person,
  roleIdValue: string,
) => orgsApi.changeRole(req(a, 'PATCH', { roleId: roleIdValue }), org, m.id, db)

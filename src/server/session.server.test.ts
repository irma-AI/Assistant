import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import pg from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { createDb } from './db.server'
import { migrate } from './migrate.server'
import { hashPnr } from './pii.server'
import {
  cookieName,
  createSession,
  deleteEndedSessions,
  logout,
  requireSession,
} from './session.server'

// One fresh, fully migrated database on the real PostgreSQL that DATABASE_URL points at.
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const name = `test_${randomUUID().replaceAll('-', '')}`
const url = new URL(process.env.DATABASE_URL ?? '')
url.pathname = `/${name}`
const db = createDb(url.href)

const pnr = '199001012387'
let userId: string

beforeAll(async () => {
  await admin.query(`create database ${name}`)
  await migrate(db)
  const user = await db
    .insertInto('users')
    .values({ name: 'Test Person', pnr_hmac: hashPnr(pnr) })
    .returning('id')
    .executeTakeFirstOrThrow()
  userId = user.id
})

afterAll(async () => {
  await db.destroy()
  await admin.query(`drop database ${name}`)
  await admin.end()
})

const bearer = (token: string) =>
  new Request('https://api.test/api/v1/me', {
    headers: { authorization: `Bearer ${token}` },
  })
const cookie = (token: string) =>
  new Request('https://api.test/api/v1/me', {
    headers: { cookie: `other=1; ${cookieName}=${token}` },
  })
const expiryOf = async () => {
  const { rows } = await sql<{
    seconds: number
  }>`select extract(epoch from expires_at - now())::float8 as seconds from sessions where user_id = ${userId} order by created_at desc limit 1`.execute(
    db,
  )
  return rows[0]?.seconds ?? 0
}
const hours = 3600

test('a valid cookie or bearer token returns the user', async () => {
  const token = await createSession(db, userId, 'web')
  for (const request of [bearer(token), cookie(token)]) {
    const response = await requireSession(request, db)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: userId })
  }
})

test.each([
  ['no credentials', new Request('https://api.test/api/v1/me')],
  ['an unknown bearer token', bearer('nope')],
  ['an unknown cookie', cookie('nope')],
])('%s returns 401', async (_label, request) => {
  const response = await requireSession(request, db)
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: 'unauthorized' })
})

test('a web session lasts 12 hours and does not slide', async () => {
  const token = await createSession(db, userId, 'web')
  expect(await expiryOf()).toBeGreaterThan(11.9 * hours)
  expect(await expiryOf()).toBeLessThanOrEqual(12 * hours)
  await requireSession(bearer(token), db)
  expect(await expiryOf()).toBeLessThanOrEqual(12 * hours)
  await sql`update sessions set created_at = now() - interval '13 hours', expires_at = now() - interval '1 hour'`.execute(
    db,
  )
  expect((await requireSession(bearer(token), db)).status).toBe(401)
})

test('an app session used within 90 days stays valid and its expiry moves forward', async () => {
  const token = await createSession(db, userId, 'app')
  await sql`update sessions set expires_at = now() + interval '1 day' where kind = 'app'`.execute(
    db,
  )
  expect((await requireSession(bearer(token), db)).status).toBe(200)
  expect(await expiryOf()).toBeGreaterThan(89.9 * 24 * hours)
})

test('an app session unused for 90 days returns 401', async () => {
  const token = await createSession(db, userId, 'app')
  await sql`update sessions set expires_at = now() - interval '1 second' where kind = 'app'`.execute(
    db,
  )
  expect((await requireSession(bearer(token), db)).status).toBe(401)
})

test('after logout the same token returns 401, and the cookie is cleared', async () => {
  const token = await createSession(db, userId, 'web')
  const out = await logout(cookie(token), db)
  expect(out.status).toBe(204)
  expect(out.headers.get('set-cookie')).toContain('Max-Age=0')
  expect((await requireSession(cookie(token), db)).status).toBe(401)
  expect((await requireSession(bearer(token), db)).status).toBe(401)
  expect((await logout(cookie(token), db)).status).toBe(204)
})

test('the personal identity number is stored nowhere readable', async () => {
  const token = await createSession(db, userId, 'web')
  const columns = await sql<{
    column_name: string
  }>`select column_name from information_schema.columns where table_name = 'users' order by 1`.execute(
    db,
  )
  expect(columns.rows.map((c) => c.column_name)).toEqual([
    'created_at',
    'id',
    'name',
    'pnr_hmac',
  ])
  const dump = await sql<{
    text: string
  }>`select u::text as text from users u union all select s::text from sessions s`.execute(
    db,
  )
  expect(JSON.stringify(dump.rows)).not.toContain(pnr)
  const me = await requireSession(bearer(token), db)
  expect(await me.text()).not.toContain(pnr)
})

test('sessions that ended over 30 days ago are deleted, the rest are kept', async () => {
  await sql`delete from sessions`.execute(db)
  const expiredOld = await createSession(db, userId, 'web')
  const revokedOld = await createSession(db, userId, 'web')
  const expiredRecent = await createSession(db, userId, 'web')
  const revokedRecent = await createSession(db, userId, 'web')
  const active = await createSession(db, userId, 'app')
  await sql`update sessions set expires_at = now() - interval '31 days' where token_hash = sha256(${expiredOld}::bytea)`.execute(
    db,
  )
  await sql`update sessions set revoked_at = now() - interval '31 days' where token_hash = sha256(${revokedOld}::bytea)`.execute(
    db,
  )
  await sql`update sessions set expires_at = now() - interval '29 days' where token_hash = sha256(${expiredRecent}::bytea)`.execute(
    db,
  )
  await sql`update sessions set revoked_at = now() - interval '29 days' where token_hash = sha256(${revokedRecent}::bytea)`.execute(
    db,
  )
  expect(await deleteEndedSessions(db)).toBe(2)
  expect((await requireSession(bearer(active), db)).status).toBe(200)
  const left = await db.selectFrom('sessions').select('token_hash').execute()
  expect(left).toHaveLength(3)
})

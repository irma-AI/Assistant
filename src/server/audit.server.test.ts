import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import pg from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { deleteExpiredAuditEvents, recordAudit } from './audit.server'
import { fakeCancelIp } from './auth/bankid-fake.server'
import { createDb } from './db.server'
import { migrate } from './migrate.server'
import { start, pollLogin } from './login.server'
import { hashPnr } from './pii.server'
import { cookieName, createSession, logout } from './session.server'

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const name = `test_${randomUUID().replaceAll('-', '')}`
const url = new URL(process.env.DATABASE_URL ?? '')
url.pathname = `/${name}`
const db = createDb(url.href)

beforeAll(async () => {
  await admin.query(`create database ${name}`)
  await migrate(db)
})

afterAll(async () => {
  await db.destroy()
  await admin.query(`drop database ${name}`)
  await admin.end()
})

const events = () =>
  db.selectFrom('audit_events').selectAll().orderBy('id').execute()

const post = (ip: string, headers: Record<string, string> = {}, body = {}) =>
  new Request('https://app.example/api/v1/x', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, ...headers },
    body: JSON.stringify(body),
  })

// Starts a login and polls it to the end; returns the session cookie if one was issued.
async function loginFrom(ip: string) {
  const started = await start(post(ip, {}, { sameDevice: false }), db)
  const login = (started.headers.getSetCookie()[0] ?? '').split(';')[0] ?? ''
  const id = login.split('=')[1] ?? ''
  let session: string | undefined
  for (let i = 0; i < 3; i++) {
    await db
      .updateTable('login_attempts')
      .set({ last_collect_at: null })
      .where('id', '=', id)
      .execute()
    const done = await pollLogin(post(ip, { cookie: login }), db)
    session ??= done.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${cookieName}=`))
      ?.split(';')[0]
  }
  return session
}

test('login success, login failure and logout each write one row, with a truncated IP and no secrets', async () => {
  const session = await loginFrom('203.0.113.7')
  await logout(post('203.0.113.7', { cookie: session ?? '' }), db)
  await loginFrom(fakeCancelIp)

  const rows = await events()
  expect(rows.map((r) => r.event)).toEqual([
    'login_success',
    'logout',
    'login_failure',
  ])
  expect(rows[0]?.ip).toBe('203.0.113.0')
  expect(rows[0]?.user_id).toBeTruthy()
  expect(JSON.stringify(rows)).not.toMatch(/\d{12}|__Host|token/)
})

test('IPv6 addresses are cut to the network', async () => {
  await recordAudit(db, { event: 'logout', ip: '2001:db8:abcd:12::1' })
  const last = (await events()).at(-1)
  expect(last?.ip).toBe('2001:db8:abcd::')
})

test('an UPDATE, DELETE or TRUNCATE from the app fails', async () => {
  await recordAudit(db, { event: 'logout' })
  for (const statement of [
    sql`update audit_events set event = 'x'`,
    sql`delete from audit_events`,
    sql`truncate audit_events`,
  ])
    await expect(statement.execute(db)).rejects.toThrow('append-only')
})

test('the hash chain links each row to the one before, and an edit shows', async () => {
  const rows = await events()
  rows.forEach((r, i) => {
    expect(r.prev_hash).toEqual(i === 0 ? null : rows[i - 1]?.hash)
  })
  // The owner bypasses the trigger here only to prove the chain notices.
  const before = rows[1]?.hash
  await sql`alter table audit_events disable trigger audit_events_append_only`.execute(
    db,
  )
  await sql`update audit_events set event = 'edited' where id = ${rows[1]?.id}`.execute(
    db,
  )
  await sql`alter table audit_events enable trigger audit_events_append_only`.execute(
    db,
  )
  const edited = await db
    .selectFrom('audit_events')
    .select(
      sql<boolean>`hash = sha256(convert_to(concat_ws('|', coalesce(encode(prev_hash, 'hex'), ''), at::text, coalesce(user_id::text, ''), coalesce(session_kind, ''), event, coalesce(ip, ''), detail::text), 'UTF8'))`.as(
        'ok',
      ),
    )
    .where('id', '=', rows[1]?.id ?? '0')
    .executeTakeFirstOrThrow()
  expect(edited.ok).toBe(false)
  expect(before).toBeTruthy()
})

test('the retention job removes only expired rows', async () => {
  await sql`alter table audit_events disable trigger audit_events_chain`.execute(
    db,
  )
  await sql`insert into audit_events (at, event, hash) values (now() - interval '13 months', 'old', '\\x00'), (now() - interval '11 months', 'recent', '\\x00')`.execute(
    db,
  )
  await sql`alter table audit_events enable trigger audit_events_chain`.execute(
    db,
  )
  const before = (await events()).length
  expect(await deleteExpiredAuditEvents(db)).toBe(1)
  const after = await events()
  expect(after.length).toBe(before - 1)
  expect(after.map((r) => r.event)).toContain('recent')
  expect(after.map((r) => r.event)).not.toContain('old')
})

test('createSession alone writes no event', async () => {
  const user = await db
    .insertInto('users')
    .values({ name: 'A', pnr_hmac: hashPnr('199001012387') })
    .returning('id')
    .executeTakeFirstOrThrow()
  const before = (await events()).length
  await createSession(db, user.id, 'web')
  expect((await events()).length).toBe(before)
})

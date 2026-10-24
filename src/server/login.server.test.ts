import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { z } from 'zod'
import pg from 'pg'
import { afterAll, beforeAll, expect, test, vi } from 'vitest'
import {
  fakeCancelIp,
  fakeHighRiskIp,
  fakeOtherIp,
} from './auth/bankid-fake.server'
import { createDb } from './db.server'
import {
  cancelLogin,
  deleteStaleLoginAttempts,
  start,
  pollLogin,
} from './login.server'
import { migrate } from './migrate.server'

vi.stubEnv('PUBLIC_URL', 'https://app.example')

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

const post = (headers: Record<string, string>, body?: object) =>
  new Request('https://app.example/api/v1/auth/bankid/x', {
    method: 'POST',
    headers,
    body: body && JSON.stringify(body),
  })

const cookieOf = (response: Response, prefix: string) =>
  response.headers
    .getSetCookie()
    .find((c) => c.startsWith(prefix))
    ?.split(';')[0]

const sessionCount = async () =>
  Number(
    (
      await db
        .selectFrom('sessions')
        .select(sql<string>`count(*)`.as('n'))
        .executeTakeFirstOrThrow()
    ).n,
  )

// Starts a login from the given IP and returns what the browser would send on every later call.
async function begin(ip: string, sameDevice = false) {
  const response = await start(
    post({ 'x-forwarded-for': `10.0.0.1, ${ip}` }, { sameDevice }),
    db,
  )
  expect(response.status).toBe(200)
  const login = cookieOf(response, '__Host-login') ?? ''
  const id = login.split('=')[1] ?? ''
  const row = await db
    .selectFrom('login_attempts')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  return { login, id, nonce: row.nonce, response }
}

// Polls as the browser does; the claimed collect slot is released first so the fake advances.
async function poll(login: string, id: string, nonce?: string) {
  await db
    .updateTable('login_attempts')
    .set({ last_collect_at: null })
    .where('id', '=', id)
    .execute()
  const response = await pollLogin(
    post({ cookie: login }, nonce ? { nonce } : {}),
    db,
  )
  return {
    response,
    body: z.record(z.string(), z.unknown()).parse(await response.json()),
  }
}

const attempts = async () =>
  (await db.selectFrom('login_attempts').select('id').execute()).length

test('QR login: pending with QR data, throttled, then a session and no leftover attempt', async () => {
  const { login, id, nonce } = await begin('203.0.113.7')
  expect(nonce).toBeNull()
  const first = await poll(login, id)
  expect(first.body).toMatchObject({ status: 'pending' })
  expect(first.body.qr).toMatch(/^bankid\.[\w-]+\.\d+\.[0-9a-f]{64}$/)
  // an immediate second poll is answered without a collect, so the fake's second collect is still ahead
  const again = await pollLogin(post({ cookie: login }), db)
  expect(await again.json()).toMatchObject({ status: 'pending' })
  const done = await poll(login, id)
  expect(done.body).toEqual({ status: 'complete' })
  expect(cookieOf(done.response, '__Host-session=')).toBeTruthy()
  expect(await attempts()).toBe(0)
})

test('same device: the right nonce completes', async () => {
  const { login, id, nonce } = await begin('203.0.113.7', true)
  expect(nonce).toBeTruthy()
  await poll(login, id, nonce ?? '')
  const done = await poll(login, id, nonce ?? '')
  expect(done.body).toEqual({ status: 'complete' })
})

test('QR login: the scanning phone may have another IP than the browser', async () => {
  const { login, id } = await begin(fakeOtherIp)
  await poll(login, id)
  const done = await poll(login, id)
  expect(done.body).toEqual({ status: 'complete' })
})

test.each([
  ['an IP mismatch on the same device', fakeOtherIp, true, 'real'],
  ['risk high', fakeHighRiskIp, false, undefined],
  ['a wrong nonce', '203.0.113.7', true, 'wrong'],
])('%s refuses the session', async (_, ip, sameDevice, nonce) => {
  const before = await sessionCount()
  const { login, id, nonce: real } = await begin(ip, sameDevice)
  const sent = nonce === 'real' ? (real ?? undefined) : nonce
  await poll(login, id, sent)
  const done = await poll(login, id, sent)
  expect(done.body).toMatchObject({ status: 'failed' })
  expect(cookieOf(done.response, '__Host-session=')).toBeUndefined()
  expect(await sessionCount()).toBe(before)
  expect(await attempts()).toBe(0)
})

test('a cancelled order fails and leaves no attempt', async () => {
  const { login, id } = await begin(fakeCancelIp)
  await poll(login, id)
  const done = await poll(login, id)
  expect(done.body).toMatchObject({ status: 'failed' })
  expect(await attempts()).toBe(0)
})

test('an order older than 30 seconds expires', async () => {
  const { login, id } = await begin('203.0.113.7')
  await db
    .updateTable('login_attempts')
    .set({ created_at: sql<Date>`now() - interval '31 seconds'` })
    .where('id', '=', id)
    .execute()
  expect((await poll(login, id)).body).toEqual({ status: 'expired' })
  expect(await attempts()).toBe(0)
})

test('cancel deletes the attempt; the sweep deletes stale ones', async () => {
  const { login } = await begin('203.0.113.7')
  expect((await cancelLogin(post({ cookie: login }), db)).status).toBe(204)
  expect(await attempts()).toBe(0)

  const stale = await begin('203.0.113.7')
  await db
    .updateTable('login_attempts')
    .set({ created_at: sql<Date>`now() - interval '1 hour'` })
    .where('id', '=', stale.id)
    .execute()
  expect(await deleteStaleLoginAttempts(db)).toBe(1)
})

test('start without a body or a client IP is a bad request', async () => {
  expect((await start(post({}), db)).status).toBe(400)
})

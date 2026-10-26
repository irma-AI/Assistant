import { sql } from 'kysely'
import { expect, test, vi } from 'vitest'
import {
  fakeBusyIp,
  fakeCancelIp,
  fakeHighRiskIp,
  fakeOtherIp,
} from './auth/bankid-fake.server'
import { cancel } from './auth/bankid.server'
import {
  attempts,
  begin,
  cookieOf,
  db,
  poll,
  post,
  sessionCount,
  useDatabase,
} from './login.fixture'
import {
  cancelLogin,
  deleteStaleLoginAttempts,
  start,
  pollLogin,
} from './login.server'

vi.stubEnv('PUBLIC_URL', 'https://app.example')
useDatabase()

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

test('same device: the starting tab gets complete without a session; only the return call with the nonce logs in', async () => {
  const before = await sessionCount()
  const { login, id, nonce, response } = await begin('203.0.113.7', true)
  expect(JSON.stringify(await response.json())).not.toContain(nonce ?? 'x')
  await poll(login, id)
  const tab = await poll(login, id)
  expect(tab.body).toEqual({ status: 'complete' })
  expect(cookieOf(tab.response, '__Host-session=')).toBeUndefined()
  expect(await sessionCount()).toBe(before)
  expect(await attempts()).toBe(1)
  const back = await poll(login, id, nonce ?? '')
  expect(back.body).toEqual({ status: 'complete' })
  expect(cookieOf(back.response, '__Host-session=')).toBeDefined()
  expect(await attempts()).toBe(0)
})

test("start shows BankID's alreadyInProgress text (RFA4)", async () => {
  const response = await start(
    post({ 'x-forwarded-for': fakeBusyIp }, { sameDevice: false }),
    db,
  )
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({
    error:
      'En identifiering eller underskrift pågår redan för ditt personnummer. Försök igen.',
  })
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

test('a failing collect call keeps the attempt and answers pending', async () => {
  const { login, id } = await begin('203.0.113.7')
  const row = await db
    .selectFrom('login_attempts')
    .select('order_ref')
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  await cancel(row.order_ref) // collect now errors, as it would on a network failure
  const reply = await poll(login, id)
  expect(reply.body).toMatchObject({ status: 'pending' })
  expect(await attempts()).toBe(1)
  await cancelLogin(post({ cookie: login }), db)
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

// A fresh BankID confirmation from the same IP is the same fake person, so it finds the account to delete.
async function confirmDeletion(ip: string) {
  const response = await start(
    post({ 'x-forwarded-for': ip }, { sameDevice: false, purpose: 'delete' }),
    db,
  )
  const login = cookieOf(response, '__Host-login') ?? ''
  const id = login.split('=')[1] ?? ''
  await poll(login, id)
  return poll(login, id)
}

const users = () => db.selectFrom('users').selectAll().execute()

test('deleting an account removes the user and every session, clears the cookie and records an audit event', async () => {
  const known = new Set((await users()).map((u) => u.id))
  const { login, id } = await begin('203.0.113.50')
  await poll(login, id)
  await poll(login, id)
  const [user] = (await users()).filter((u) => !known.has(u.id))
  const other = await begin('203.0.113.51')
  await poll(other.login, other.id)
  await poll(other.login, other.id)
  const before = (await users()).length

  const done = await confirmDeletion('203.0.113.50')
  expect(done.body).toEqual({ status: 'complete' })
  expect(cookieOf(done.response, '__Host-session=')).toBe('__Host-session=')
  expect(await users()).toHaveLength(before - 1)
  expect(
    await db
      .selectFrom('sessions')
      .select('user_id')
      .where('user_id', '=', user?.id ?? '')
      .execute(),
  ).toEqual([])
  expect(
    await db
      .selectFrom('audit_events')
      .select('detail')
      .where('event', '=', 'account_deleted')
      .where('user_id', '=', user?.id ?? '')
      .execute(),
  ).toHaveLength(1)
  expect(await attempts()).toBe(0)
})

test('confirming deletion for an identity with no account fails and deletes nothing', async () => {
  const before = [(await users()).length, await sessionCount()]
  const done = await confirmDeletion('203.0.113.60')
  expect(done.body).toMatchObject({ status: 'failed' })
  expect([(await users()).length, await sessionCount()]).toEqual(before)
})

test('a login prints no identity number, name, token or full IP to the logs', async () => {
  const printed: string[] = []
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      printed.push(args.map(String).join(' '))
    }),
  )
  const writes = [process.stdout, process.stderr].map((s) =>
    vi.spyOn(s, 'write').mockImplementation((chunk: unknown) => {
      printed.push(String(chunk))
      return true
    }),
  )
  const ip = '203.0.113.77'
  const { login, id } = await begin(ip)
  await poll(login, id)
  const done = await poll(login, id)
  // a failing collect is the path most likely to log an error
  const failing = await begin(ip)
  const row = await db
    .selectFrom('login_attempts')
    .select('order_ref')
    .where('id', '=', failing.id)
    .executeTakeFirstOrThrow()
  await cancel(row.order_ref)
  await poll(failing.login, failing.id)
  await cancelLogin(post({ cookie: failing.login }), db)
  ;[...spies, ...writes].forEach((s) => {
    s.mockRestore()
  })

  const user = await db
    .selectFrom('users')
    .select('name')
    .orderBy('created_at', 'desc')
    .executeTakeFirstOrThrow()
  const output = printed.join('\n')
  const secrets = [
    ip,
    user.name,
    login.split('=')[1] ?? '',
    cookieOf(done.response, '__Host-session=')?.split('=')[1] ?? '',
  ]
  secrets.forEach((s) => {
    expect(s).not.toBe('')
    expect(output).not.toContain(s)
  })
  expect(output).not.toMatch(/\b(?:19|20)?\d{6}[-+]?\d{4}\b/)
})

test('start answers 429 after 20 starts from one /24, without placing an order, and logs no raw IP', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
    // collected below
  })
  const from = (host: number) =>
    post(
      { 'x-forwarded-for': `198.51.100.${String(host)}` },
      { sameDevice: false },
    )
  for (let i = 1; i <= 20; i++)
    expect((await start(from(i), db)).status).toBe(200)
  const before = await attempts()
  const refused = await start(from(99), db)
  expect(refused.status).toBe(429)
  expect(await attempts()).toBe(before)
  const lines = warn.mock.calls.map((c) => String(c[0]))
  warn.mockRestore()
  const line = lines.find((l) => l.includes('rate_limited')) ?? ''
  expect(JSON.parse(line)).toMatchObject({ event: 'rate_limited', status: 429 })
  expect(line).not.toContain('198.51.100')
  // the count is in the database, so another network is unaffected and a fresh instance still refuses
  expect(
    (
      await start(
        post({ 'x-forwarded-for': '203.0.113.9' }, { sameDevice: false }),
        db,
      )
    ).status,
  ).toBe(200)
  vi.resetModules()
  const fresh = await import('./login.server')
  expect((await fresh.start(from(7), db)).status).toBe(429)
})

import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, expect, test } from 'vitest'
import { makeDemo } from '../../seeds/demo.ts'
import { refuseDemo } from './access.server'
import {
  deleteDemoAccount,
  demoLogin,
  demoOrgId,
  demoUserId,
  ensureDemo,
} from './demo.server'
import { hashPassword, verifyPassword } from './demo-password.server'
import snapshot from './demo-snapshot.json' with { type: 'json' }
import { addMember } from './members.server'
import { db, newOrg, person, req, roleId, useDatabase } from './orgs.fixture'
import { orgsApi } from './orgs.api.server'
import { authenticateSession } from './session.server'

useDatabase()
const password = 'a long random demo password'
let n = 0
const call = (ip: string, body: object) =>
  new Request('https://api.test/api/v1/auth/demo', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
const login = (ip: string, pw = password, username = 'demo') =>
  demoLogin(call(ip, { username, password: pw }), db)
const freshIp = () => `10.1.${String(++n)}.1`
const tokenOf = (r: Response) =>
  /__Host-session=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? ''
const asDemo = async (r: Response) =>
  new Request('https://api.test/x', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokenOf(r)}`,
      'x-forwarded-for': freshIp(),
    },
    body: JSON.stringify({ password }),
  })

beforeAll(async () => {
  process.env.DEMO_PASSWORD_HASH = await hashPassword(password)
  delete process.env.DEMO_LOGIN_ENABLED
})

test('a demo login reaches only demo data', async () => {
  const other = await newOrg(await person())
  const r = await login(freshIp())
  expect(r.status).toBe(200)
  const s = await authenticateSession(db, await asDemo(r))
  expect(s).toEqual({ userId: demoUserId, kind: 'demo' })
  const orgs = await orgsApi.list(await asDemo(r), db)
  expect(await orgs.json()).toMatchObject([{ id: demoOrgId, role: 'Ägare' }])
  const peek = await orgsApi.me(await asDemo(r), other.id, db)
  expect(peek.status).toBe(404)
})

test('a wrong password or a wrong username is the same 401, and a real user cannot use the route', async () => {
  const real = await db
    .insertInto('users')
    .values({ name: 'Real Person' })
    .returning('id')
    .executeTakeFirstOrThrow()
  const bad = await login(freshIp(), 'nope')
  const unknown = await login(freshIp(), password, 'someone')
  const asReal = await login(freshIp(), password, real.id)
  for (const r of [bad, unknown, asReal]) {
    expect(r.status).toBe(401)
    expect(await r.json()).toEqual({ error: 'unauthorized' })
  }
})

test('the hash is Argon2id and a malformed one never matches', async () => {
  const h = await hashPassword('x')
  expect(h).toMatch(/^argon2id\$m=19456,t=2,p=1\$/)
  expect(await verifyPassword('x', h)).toBe(true)
  expect(await verifyPassword('y', h)).toBe(false)
  expect(await verifyPassword('x', 'plain')).toBe(false)
  expect(await verifyPassword('x', undefined)).toBe(false)
})

test('a demo session is refused anything with an outside effect, and cannot create an organisation', async () => {
  expect(() => {
    refuseDemo('demo')
  }).toThrow('demo_session')
  expect(() => {
    refuseDemo('web')
  }).not.toThrow()
  const r = await login(freshIp())
  const created = await orgsApi.create(
    req({ id: demoUserId, token: tokenOf(r) }, 'POST', { name: 'Nytt AB' }),
    db,
  )
  expect(created.status).toBe(403)
})

test('the demo user can neither invite nor be invited', async () => {
  await login(freshIp())
  const owner = await person()
  const org = await newOrg(owner)
  const role = await roleId(owner, org.id, 'Medlem')
  await expect(
    addMember(db, owner.id, org.id, demoUserId, role, {}),
  ).rejects.toThrow('demo_session')
  await expect(
    addMember(db, demoUserId, demoOrgId, owner.id, role, {}),
  ).rejects.toThrow('demo_session')
})

test('with DEMO_LOGIN_ENABLED=false the route returns 404', async () => {
  process.env.DEMO_LOGIN_ENABLED = 'false'
  try {
    expect((await login(freshIp())).status).toBe(404)
  } finally {
    delete process.env.DEMO_LOGIN_ENABLED
  }
})

test('changes stay at the next login, and deletion takes the account and organisation, which the next login rebuilds', async () => {
  const first = await login(freshIp())
  await db
    .updateTable('organisations')
    .set({ name: 'Ändrat AB' })
    .where('id', '=', demoOrgId)
    .execute()
  await login(freshIp())
  expect(
    (
      await db
        .selectFrom('organisations')
        .select('name')
        .where('id', '=', demoOrgId)
        .executeTakeFirstOrThrow()
    ).name,
  ).toBe('Ändrat AB')

  const wrong = new Request('https://api.test/x', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokenOf(first)}`,
      'x-forwarded-for': freshIp(),
    },
    body: JSON.stringify({ password: 'nope' }),
  })
  expect((await deleteDemoAccount(wrong, db)).status).toBe(401)
  expect((await deleteDemoAccount(await asDemo(first), db)).status).toBe(204)
  const left = await db
    .selectFrom('users')
    .select('id')
    .where('id', 'in', [demoUserId, ...snapshot.members.map((m) => m.id)])
    .execute()
  expect(left).toEqual([])
  expect(
    await db
      .selectFrom('organisations')
      .select('id')
      .where('id', '=', demoOrgId)
      .execute(),
  ).toEqual([])

  expect((await login(freshIp())).status).toBe(200)
  const org = await db
    .selectFrom('organisations')
    .select('name')
    .where('id', '=', demoOrgId)
    .executeTakeFirstOrThrow()
  expect(org.name).toBe(snapshot.organisation.name)
  expect(await ensureDemo(db)).toBe(false)
})

test('many failed logins throttle that IP only', async () => {
  const ip = freshIp()
  for (let i = 0; i < 10; i++)
    expect((await login(ip, 'nope')).status).toBe(401)
  expect((await login(ip, 'nope')).status).toBe(429)
  expect((await login(ip)).status).toBe(429)
  expect((await login(freshIp())).status).toBe(200)
})

test('the snapshot equals the factory output for the fixed seed', () => {
  expect(snapshot).toEqual(makeDemo())
})

test('Faker is not imported from src/server', () => {
  for (const f of readdirSync('src/server', {
    recursive: true,
    encoding: 'utf8',
  })) {
    if (!/\.tsx?$/.test(f) || f.endsWith('.test.ts')) continue
    expect(readFileSync(`src/server/${f}`, 'utf8'), f).not.toContain(
      '@faker-js/faker',
    )
  }
})

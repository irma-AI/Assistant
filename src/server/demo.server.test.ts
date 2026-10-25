import { readdirSync, readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
import { z } from 'zod'
import { makeDemo } from '../../seeds/demo.ts'
import snapshot from './demo-snapshot.json' with { type: 'json' }
import {
  demoDelete,
  demoLogin,
  demoOrgId,
  demoPasswordHash,
  demoUserId,
  refuseDemo,
} from './demo.server'
import { addMember } from './members.server'
import { orgsApi } from './orgs.api.server'
import { db, idOf, person, req, useDatabase } from './orgs.fixture'

useDatabase()

const password = 'correct horse battery staple'
vi.stubEnv('DEMO_PASSWORD_HASH', await demoPasswordHash(password))

const post = (path: string, body: object, ip: string, cookie?: string) =>
  new Request(`https://api.test/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  })
const login = (ip = '10.0.0.1', pw = password, username = 'demo') =>
  demoLogin(post('demo', { username, password: pw }, ip), db)
const cookieOf = (r: Response) =>
  r.headers.get('set-cookie')?.split(';')[0] ?? ''
const asDemo = async () => {
  const cookie = cookieOf(await login())
  return {
    cookie,
    request: (method: string, body?: object) =>
      new Request('https://api.test/api/v1/x', {
        method,
        headers: { cookie },
        body: body && JSON.stringify(body),
      }),
  }
}

test('a demo login reaches only demo data', async () => {
  const other = await person()
  const org = idOf(
    await orgsApi.create(req(other, 'POST', { name: 'Real AB' }), db),
  )
  const demo = await asDemo()
  const list = z
    .array(z.object({ id: z.string() }))
    .parse(await (await orgsApi.list(demo.request('GET'), db)).json())
  expect(list.map((o) => o.id)).toEqual([demoOrgId])
  const foreign = await orgsApi.me(demo.request('GET'), (await org).id, db)
  expect(foreign.status).toBe(404)
  const session = await db
    .selectFrom('sessions')
    .select(['user_id', 'kind'])
    .where('user_id', '=', demoUserId)
    .executeTakeFirstOrThrow()
  expect(session.kind).toBe('demo')
})

test('a wrong password or username is a 401 that says nothing about which', async () => {
  const wrongPassword = await login('10.0.1.1', 'nope')
  const wrongUser = await login('10.0.1.2', password, 'someone')
  expect(wrongPassword.status).toBe(401)
  expect(wrongUser.status).toBe(401)
  expect(await wrongUser.text()).toBe(await wrongPassword.text())
  const real = await person()
  const asReal = await demoDelete(
    post(
      'demo/delete',
      { password },
      '10.0.1.3',
      `__Host-session=${real.token}`,
    ),
    db,
  )
  expect(asReal.status).toBe(401)
})

test('with DEMO_LOGIN_ENABLED=false the route returns 404', async () => {
  vi.stubEnv('DEMO_LOGIN_ENABLED', 'false')
  expect((await login('10.0.2.1')).status).toBe(404)
  vi.stubEnv('DEMO_LOGIN_ENABLED', 'true')
})

test('a demo session cannot create organisations or invite, and the demo user cannot be added elsewhere', async () => {
  const demo = await asDemo()
  const created = await orgsApi.create(demo.request('POST', { name: 'X' }), db)
  expect(created.status).toBe(403)
  expect(() => {
    refuseDemo('demo')
  }).toThrow('demo_session')
  expect(() => {
    refuseDemo('web')
  }).not.toThrow()
  const owner = await person()
  const org = await idOf(
    await orgsApi.create(req(owner, 'POST', { name: 'Y AB' }), db),
  )
  const role = await db
    .selectFrom('roles')
    .select('id')
    .where('organisation_id', '=', org.id)
    .executeTakeFirstOrThrow()
  await expect(
    addMember(db, owner.id, org.id, demoUserId, role.id, { userId: owner.id }),
  ).rejects.toThrow('demo_session')
})

test('changes persist across demo logins, and deletion is followed by a recreation from the snapshot', async () => {
  await db
    .updateTable('organisations')
    .set({ name: 'Changed' })
    .where('id', '=', demoOrgId)
    .execute()
  const first = await asDemo()
  const kept = await db
    .selectFrom('organisations')
    .select('name')
    .where('id', '=', demoOrgId)
    .executeTakeFirstOrThrow()
  expect(kept.name).toBe('Changed')

  const deleted = await demoDelete(
    post('demo/delete', { password }, '10.0.3.1', first.cookie),
    db,
  )
  expect(deleted.status).toBe(204)
  const gone = await db
    .selectFrom('organisations')
    .select('id')
    .where('id', '=', demoOrgId)
    .execute()
  expect(gone).toEqual([])

  await asDemo()
  const back = await db
    .selectFrom('organisations')
    .select('name')
    .where('id', '=', demoOrgId)
    .executeTakeFirstOrThrow()
  expect(back.name).toBe(snapshot.organisation.name)
  const events = await db
    .selectFrom('audit_events')
    .select('event')
    .where('event', '=', 'demo_recreated')
    .execute()
  expect(events.length).toBeGreaterThanOrEqual(2)
})

test('failed logins throttle that network but not another', async () => {
  for (let i = 0; i < 10; i++) await login('10.9.9.1', 'nope')
  expect((await login('10.9.9.1', 'nope')).status).toBe(429)
  expect((await login('10.9.9.1')).status).toBe(429)
  expect((await login('10.8.8.1')).status).toBe(204)
})

test('the failure alert leaves out the submitted credentials', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  await login('10.7.7.1', 'secret-guess', 'secret-name')
  const logged = warn.mock.calls.flat().join(' ')
  warn.mockRestore()
  expect(logged).toContain('demo_login_failed')
  expect(logged).not.toMatch(/secret|10\.7\.7/)
})

test('the snapshot equals the factory output for the fixed seed', () => {
  expect(snapshot).toEqual(makeDemo())
})

test('Faker is not imported from src/server', () => {
  const files = readdirSync('src/server', {
    recursive: true,
    withFileTypes: true,
  })
    .filter(
      (f) =>
        f.isFile() && /\.tsx?$/.test(f.name) && !f.name.endsWith('.test.ts'),
    )
    .map((f) => readFileSync(`${f.parentPath}/${f.name}`, 'utf8'))
  expect(files.filter((c) => c.includes('@faker-js/faker'))).toEqual([])
})

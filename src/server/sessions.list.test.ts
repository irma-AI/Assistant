import { expect, test } from 'vitest'
import { sessions } from '#/api/schemas'
import { db, person, useDatabase } from './orgs.fixture'
import { createSession, endSessions, listSessions } from './session.server'

useDatabase()

const as = (token: string, method = 'GET') =>
  new Request('https://api.test/api/v1/me/sessions', {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
const list = async (token: string) =>
  sessions.parse(await (await listSessions(as(token), db)).json())

test('lists the caller’s live sessions with kind, times and the current one marked', async () => {
  const me = await person()
  const other = await createSession(db, me.id, 'app')
  const rows = await list(me.token)
  expect(rows.map((r) => [r.kind, r.current]).sort()).toEqual([
    ['app', false],
    ['web', true],
  ])
  expect(rows.every((r) => !Number.isNaN(Date.parse(r.lastUsedAt)))).toBe(true)
  expect((await list(other)).filter((r) => r.current)[0]?.kind).toBe('app')
})

test('ending a session makes its next request 401; end all others keeps only the current one', async () => {
  const me = await person()
  const second = await createSession(db, me.id, 'app')
  const third = await createSession(db, me.id, 'web')
  const target = (await list(me.token)).find((r) => r.kind === 'app')
  expect(
    (await endSessions(as(me.token, 'DELETE'), target?.id, db)).status,
  ).toBe(204)
  expect((await listSessions(as(second), db)).status).toBe(401)

  expect(
    (await endSessions(as(me.token, 'DELETE'), undefined, db)).status,
  ).toBe(204)
  expect((await listSessions(as(third), db)).status).toBe(401)
  expect((await list(me.token)).map((r) => r.current)).toEqual([true])
})

test('another user’s sessions are neither listed nor ended, and answer 404', async () => {
  const me = await person()
  const them = await person()
  const theirs = (await list(them.token))[0]
  expect((await list(me.token)).some((r) => r.id === theirs?.id)).toBe(false)
  expect(
    (await endSessions(as(me.token, 'DELETE'), theirs?.id, db)).status,
  ).toBe(404)
  expect(
    (await endSessions(as(me.token, 'DELETE'), 'nonsense', db)).status,
  ).toBe(404)
  expect((await listSessions(as(them.token), db)).status).toBe(200)
  await endSessions(as(me.token, 'DELETE'), undefined, db)
  expect((await listSessions(as(them.token), db)).status).toBe(200)
})

test('no token is 401', async () => {
  const bare = new Request('https://api.test/api/v1/me/sessions')
  expect((await listSessions(bare, db)).status).toBe(401)
  expect((await endSessions(bare, undefined, db)).status).toBe(401)
})

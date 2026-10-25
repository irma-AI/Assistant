import { sql } from 'kysely'
import { z } from 'zod'
import { expect } from 'vitest'
import { pollLogin, start } from './login.server'
import { db } from './orgs.fixture'

export { db, useDatabase } from './orgs.fixture'

export const post = (headers: Record<string, string>, body?: object) =>
  new Request('https://app.example/api/v1/auth/bankid/x', {
    method: 'POST',
    headers,
    body: body && JSON.stringify(body),
  })

export const cookieOf = (response: Response, prefix: string) =>
  response.headers
    .getSetCookie()
    .find((c) => c.startsWith(prefix))
    ?.split(';')[0]

export const sessionCount = async () =>
  Number(
    (
      await db
        .selectFrom('sessions')
        .select(sql<string>`count(*)`.as('n'))
        .executeTakeFirstOrThrow()
    ).n,
  )

// Starts a login from the given IP and returns what the browser would send on every later call.
export async function begin(ip: string, sameDevice = false) {
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
export async function poll(login: string, id: string, nonce?: string) {
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

export const attempts = async () =>
  (await db.selectFrom('login_attempts').select('id').execute()).length

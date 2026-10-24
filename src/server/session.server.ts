import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import type { errorBody, me } from '#/api/schemas'
import type { DB } from './db.gen'
import { getDb } from './db.server'

type Kind = 'web' | 'app' | 'demo'

export const cookieName = '__Host-session'
const webSeconds = 12 * 60 * 60
const appSeconds = 90 * 24 * 60 * 60

const hash = (token: string) => createHash('sha256').update(token).digest()

export async function createSession(
  db: Kysely<DB>,
  userId: string,
  kind: Kind,
) {
  const token = randomBytes(32).toString('base64url')
  const seconds = kind === 'app' ? appSeconds : webSeconds
  await db
    .insertInto('sessions')
    .values({
      token_hash: hash(token),
      user_id: userId,
      kind,
      expires_at: sql<Date>`now() + ${seconds} * interval '1 second'`,
    })
    .execute()
  return token
}

function tokenOf(request: Request) {
  const bearer = /^Bearer (\S+)$/.exec(
    request.headers.get('authorization') ?? '',
  )
  if (bearer) return bearer[1]
  const cookies = request.headers.get('cookie') ?? ''
  return cookies
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1)
}

// Returns the session's user and, for an app session, moves its expiry forward in the same statement.
async function authenticate(db: Kysely<DB>, request: Request) {
  const token = tokenOf(request)
  if (!token) return undefined
  const row = await db
    .updateTable('sessions')
    .set({
      last_used_at: sql<Date>`now()`,
      expires_at: sql<Date>`case when kind = 'app' then now() + ${appSeconds} * interval '1 second' else expires_at end`,
    })
    .where('token_hash', '=', hash(token))
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', sql<Date>`now()`)
    .returning('user_id')
    .executeTakeFirst()
  return row?.user_id
}

const unauthorized = () => {
  const body: z.infer<typeof errorBody> = { error: 'unauthorized' }
  return Response.json(body, { status: 401 })
}

export async function requireSession(request: Request, db = getDb()) {
  const id = await authenticate(db, request)
  if (!id) return unauthorized()
  const body: z.infer<typeof me> = { id }
  return Response.json(body)
}

// Revokes the session behind the request and clears the cookie. Logging out twice is not an error.
export async function logout(request: Request, db = getDb()) {
  const token = tokenOf(request)
  if (token)
    await db
      .updateTable('sessions')
      .set({ revoked_at: sql<Date>`now()` })
      .where('token_hash', '=', hash(token))
      .where('revoked_at', 'is', null)
      .execute()
  return new Response(null, {
    status: 204,
    headers: {
      'set-cookie': `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
    },
  })
}

// Ended sessions (expired or revoked) are kept 30 days, then deleted (GDPR Art. 5(1)(e)).
export async function deleteEndedSessions(db: Kysely<DB>) {
  const { numDeletedRows } = await db
    .deleteFrom('sessions')
    .where(
      sql<boolean>`least(expires_at, revoked_at) < now() - interval '30 days'`,
    )
    .executeTakeFirstOrThrow()
  return Number(numDeletedRows)
}

import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import type { errorBody, me } from '#/api/schemas'
import { clientIp, recordAudit } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'

type Kind = 'web' | 'app' | 'demo'

export const cookieName = '__Host-session'
// NIST SP 800-63B AAL2, on every client (IRM-130): 24 hours overall, 1 hour without a request.
export const webSeconds = 24 * 60 * 60
const idleSeconds = 60 * 60
// last_used_at is written at most this often per session.
const touchSeconds = 60

const hash = (token: string) => createHash('sha256').update(token).digest()

export async function createSession(
  db: Kysely<DB>,
  userId: string,
  kind: Kind,
) {
  const token = randomBytes(32).toString('base64url')
  await db
    .insertInto('sessions')
    .values({
      token_hash: hash(token),
      user_id: userId,
      kind,
      expires_at: sql<Date>`now() + ${webSeconds} * interval '1 second'`,
    })
    .execute()
  return token
}

export function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? ''
  return cookies
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

function tokenOf(request: Request) {
  const bearer = /^Bearer (\S+)$/.exec(
    request.headers.get('authorization') ?? '',
  )
  if (bearer) return bearer[1]
  return cookieValue(request, cookieName)
}

// Returns the session's user and kind while it is within both limits; last_used_at moves at most once a minute.
export async function authenticateSession(
  db: Kysely<DB> | undefined,
  request: Request,
) {
  const token = tokenOf(request)
  if (!token) return undefined
  const conn = db ?? getDb()
  const row = await conn
    .selectFrom('sessions')
    .select(['user_id', 'kind'])
    .where('token_hash', '=', hash(token))
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', sql<Date>`now()`)
    .where(
      'last_used_at',
      '>',
      sql<Date>`now() - ${idleSeconds} * interval '1 second'`,
    )
    .executeTakeFirst()
  if (!row) return undefined
  await conn
    .updateTable('sessions')
    .set({ last_used_at: sql<Date>`now()` })
    .where('token_hash', '=', hash(token))
    .where(
      'last_used_at',
      '<',
      sql<Date>`now() - ${touchSeconds} * interval '1 second'`,
    )
    .execute()
  return { userId: row.user_id, kind: row.kind }
}

export async function authenticate(
  db: Kysely<DB> | undefined,
  request: Request,
) {
  return (await authenticateSession(db, request))?.userId
}

export const unauthorized = () => {
  const body: z.infer<typeof errorBody> = { error: 'unauthorized' }
  return Response.json(body, { status: 401 })
}

// db is only opened for a request that carries a token.
export async function requireSession(request: Request, db?: Kysely<DB>) {
  const id = await authenticate(db, request)
  if (!id) return unauthorized()
  const body: z.infer<typeof me> = { id }
  return Response.json(body)
}

// Revokes the session behind the request and clears the cookie. Logging out twice is not an error.
export async function logout(request: Request, db?: Kysely<DB>) {
  const token = tokenOf(request)
  if (token) {
    const conn = db ?? getDb()
    const ended = await conn
      .updateTable('sessions')
      .set({ revoked_at: sql<Date>`now()` })
      .where('token_hash', '=', hash(token))
      .where('revoked_at', 'is', null)
      .returning(['user_id', 'kind'])
      .executeTakeFirst()
    if (ended)
      await recordAudit(conn, {
        event: 'logout',
        userId: ended.user_id,
        sessionKind: ended.kind,
        ip: clientIp(request),
      })
  }
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

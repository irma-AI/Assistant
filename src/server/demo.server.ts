import { argon2, randomBytes, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { HttpError } from './access.server'
import { clientIp, recordAudit, truncate } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import snapshot from './demo-snapshot.json' with { type: 'json' }
import {
  authenticateSession,
  cookieName,
  createSession,
  webSeconds,
} from './session.server'

// The demo user and organisation are ordinary rows with fixed IDs; only the session's kind marks demo (IRM-91).
export const demoUserId = '00000000-0000-4000-8000-000000000091'
export const demoOrgId = '00000000-0000-4000-8000-000000000092'
const username = 'demo'
const maxFailures = 10
const failureWindow = '15 minutes'

const derive = promisify(argon2)

// OWASP's minimum for Argon2id: 19 MiB, 2 passes, 1 lane.
const key = (password: string, salt: Buffer, m: number, t: number, p: number) =>
  derive('argon2id', {
    message: password,
    nonce: salt,
    memory: m,
    passes: t,
    parallelism: p,
    tagLength: 32,
  })

// DEMO_PASSWORD_HASH format: argon2id$m=19456,t=2,p=1$<salt b64>$<key b64>
export async function demoPasswordHash(password: string) {
  const salt = randomBytes(16)
  const tag = await key(password, salt, 19456, 2, 1)
  return `argon2id$m=19456,t=2,p=1$${salt.toString('base64')}$${tag.toString('base64')}`
}

async function passwordMatches(password: string, stored: string) {
  const m = /^argon2id\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/.exec(stored)
  const [, mem, t, p, salt, tag] = m ?? []
  if (!(mem && t && p && salt && tag)) return false
  const want = Buffer.from(tag, 'base64')
  const got = await key(password, Buffer.from(salt, 'base64'), +mem, +t, +p)
  return want.length === got.length && timingSafeEqual(want, got)
}

const enabled = () =>
  process.env.DEMO_LOGIN_ENABLED !== 'false' && process.env.DEMO_PASSWORD_HASH

// Every action with an external effect (filing, payment, email, invites, BankID signing) calls this first.
export function refuseDemo(kind: string) {
  if (kind === 'demo') throw new HttpError(403, 'demo_session')
}

// Creates the demo user and organisation from the snapshot when they don't exist; otherwise changes nothing.
export async function ensureDemo(db: Kysely<DB>) {
  await db.transaction().execute(async (trx) => {
    const user = await trx
      .insertInto('users')
      .values({ id: demoUserId, name: snapshot.user.name })
      .onConflict((oc) => oc.column('id').doNothing())
      .returning('id')
      .executeTakeFirst()
    if (!user) return
    await trx
      .insertInto('organisations')
      .values({ id: demoOrgId, name: snapshot.organisation.name })
      .execute()
    const owner = await trx
      .insertInto('roles')
      .values({
        organisation_id: demoOrgId,
        name: 'Ägare',
        kind: 'owner',
        permissions: [],
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    await trx
      .insertInto('roles')
      .values({
        organisation_id: demoOrgId,
        name: 'Medlem',
        kind: 'custom',
        permissions: [],
      })
      .execute()
    await trx
      .insertInto('memberships')
      .values({
        user_id: demoUserId,
        organisation_id: demoOrgId,
        role_id: owner.id,
      })
      .execute()
    await recordAudit(trx, {
      event: 'demo_recreated',
      userId: demoUserId,
      sessionKind: 'demo',
    })
  })
}

const credentials = z.object({
  username: z.string().default(username),
  password: z.string(),
})
const json = (body: object, status: number) => Response.json(body, { status })
const unauthorized = () => json({ error: 'unauthorized' }, 401)

// One check for both routes, so neither says whether the username or the password was wrong.
async function verified(
  request: Request,
  db: Kysely<DB>,
  ip: string | undefined,
) {
  const given = credentials.safeParse(await request.json().catch(() => null))
  const ok =
    given.success &&
    (await passwordMatches(
      given.data.password,
      process.env.DEMO_PASSWORD_HASH ?? '',
    )) &&
    given.data.username === username
  if (ok) return true
  await recordAudit(db, { event: 'login_failure', sessionKind: 'demo', ip })
  // The alert carries no username, password or full address (IRM-100).
  console.warn(JSON.stringify({ event: 'demo_login_failed' }))
  return false
}

// No account lockout (ASVS 6.1.1): one shared account would lock out every reviewer. Failures throttle the caller's network.
const throttled = async (db: Kysely<DB>, ip: string | undefined) => {
  const { n } = await db
    .selectFrom('audit_events')
    .select(sql<number>`count(*)::int`.as('n'))
    .where('event', '=', 'login_failure')
    .where('session_kind', '=', 'demo')
    .where('ip', '=', truncate(ip))
    .where('at', '>', sql<Date>`now() - ${failureWindow}::interval`)
    .executeTakeFirstOrThrow()
  return n >= maxFailures
}

const cookie = (value: string, maxAge: number) =>
  `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${String(maxAge)}`

export async function demoLogin(request: Request, db: Kysely<DB> = getDb()) {
  if (!enabled()) return json({ error: 'not_found' }, 404)
  const ip = clientIp(request)
  if (!ip) return json({ error: 'bad_request' }, 400)
  if (await throttled(db, ip)) return json({ error: 'too_many_attempts' }, 429)
  if (!(await verified(request, db, ip))) return unauthorized()
  await ensureDemo(db)
  const token = await createSession(db, demoUserId, 'demo')
  await recordAudit(db, {
    event: 'login_success',
    userId: demoUserId,
    sessionKind: 'demo',
    ip,
  })
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': cookie(token, webSeconds) },
  })
}

// Account deletion for the demo session, confirmed with the password instead of BankID. It removes the demo user
// and organisation together, an exception to the last-Ägare rule; the next demo login recreates both.
export async function demoDelete(request: Request, db: Kysely<DB> = getDb()) {
  if (!enabled()) return json({ error: 'not_found' }, 404)
  const session = await authenticateSession(db, request)
  if (session?.kind !== 'demo') return unauthorized()
  const ip = clientIp(request)
  if (await throttled(db, ip)) return json({ error: 'too_many_attempts' }, 429)
  if (!(await verified(request, db, ip))) return unauthorized()
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('organisations').where('id', '=', demoOrgId).execute()
    await trx.deleteFrom('users').where('id', '=', demoUserId).execute()
    await recordAudit(trx, {
      event: 'account_deleted',
      userId: demoUserId,
      sessionKind: 'demo',
      ip,
    })
  })
  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': cookie('', 0) },
  })
}

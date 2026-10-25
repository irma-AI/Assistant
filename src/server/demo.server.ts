import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { z } from 'zod'
import { clientIp, recordAudit } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import snapshot from './demo-snapshot.json' with { type: 'json' }
import { verifyPassword } from './demo-password.server'
import {
  authenticateSession,
  cookieName,
  createSession,
  webSeconds,
} from './session.server'

// Fixed ids: what marks a demo session is its kind, not a column.
export const demoUserId = '00000000-0000-4000-8000-0000000000d1'
export const demoOrgId = '00000000-0000-4000-8000-0000000000d2'
const demoIds = [demoUserId, ...snapshot.members.map((m) => m.id)]

const maxFailures = 10
const windowMs = 15 * 60 * 1000
// shortcut: per process, forgotten on restart; one Dokploy instance runs the app, so move it to PostgreSQL if that changes.
const failures = new Map<string, { n: number; since: number }>()

const throttled = (ip: string) => {
  const f = failures.get(ip)
  if (!f || Date.now() - f.since > windowMs) return false
  return f.n >= maxFailures
}

function fail(ip: string) {
  const f = failures.get(ip)
  const fresh = !f || Date.now() - f.since > windowMs
  failures.set(ip, {
    n: fresh ? 1 : f.n + 1,
    since: fresh ? Date.now() : f.since,
  })
}

const json = (body: object | null, status = 200, headers?: HeadersInit) =>
  body === null
    ? new Response(null, { status: 204, headers })
    : Response.json(body, { status, headers })

// Deletes the demo organisation (roles and memberships go with it) and every demo user.
async function removeDemo(trx: Kysely<DB>) {
  await trx.deleteFrom('organisations').where('id', '=', demoOrgId).execute()
  await trx.deleteFrom('users').where('id', 'in', demoIds).execute()
}

// Builds the demo from the snapshot when it is missing; otherwise changes nothing, so a reviewer's edits stay.
export async function ensureDemo(db: Kysely<DB>) {
  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext('demo'))`.execute(trx)
    const there = await trx
      .selectFrom('memberships')
      .select('user_id')
      .where('user_id', '=', demoUserId)
      .where('organisation_id', '=', demoOrgId)
      .executeTakeFirst()
    if (there) return false
    await removeDemo(trx)
    await trx
      .insertInto('users')
      .values([
        { id: demoUserId, name: snapshot.owner.name },
        ...snapshot.members,
      ])
      .execute()
    await trx
      .insertInto('organisations')
      .values({ id: demoOrgId, name: snapshot.organisation.name })
      .execute()
    const [owner, member] = await trx
      .insertInto('roles')
      .values([
        {
          organisation_id: demoOrgId,
          name: 'Ägare',
          kind: 'owner',
          permissions: [],
        },
        {
          organisation_id: demoOrgId,
          name: 'Medlem',
          kind: 'custom',
          permissions: [],
        },
      ])
      .returning(['id', 'kind'])
      .execute()
    if (!owner || !member) throw new Error('demo roles missing')
    const [ownerRole, memberRole] =
      owner.kind === 'owner' ? [owner, member] : [member, owner]
    await trx
      .insertInto('memberships')
      .values([
        {
          user_id: demoUserId,
          organisation_id: demoOrgId,
          role_id: ownerRole.id,
        },
        ...snapshot.members.map((m) => ({
          user_id: m.id,
          organisation_id: demoOrgId,
          role_id: memberRole.id,
        })),
      ])
      .execute()
    return true
  })
}

const body = z.object({ username: z.string(), password: z.string() })

// 404 when switched off or not configured; the failure answer never says whether the username exists.
export async function demoLogin(request: Request, db: Kysely<DB> = getDb()) {
  const hash = process.env.DEMO_PASSWORD_HASH
  if (process.env.DEMO_LOGIN_ENABLED === 'false' || !hash)
    return json({ error: 'not_found' }, 404)
  const ip = clientIp(request)
  const input = body.safeParse(await request.json().catch(() => null))
  if (!input.success || !ip) return json({ error: 'bad_request' }, 400)
  if (throttled(ip)) return json({ error: 'too_many_attempts' }, 429)

  // Always run the hash, so a wrong username takes as long as a wrong password.
  const passwordOk = await verifyPassword(input.data.password, hash)
  if (input.data.username !== 'demo' || !passwordOk) {
    fail(ip)
    await recordAudit(db, { event: 'login_failure', sessionKind: 'demo', ip })
    // The alert: a log line without the submitted username or password.
    console.warn(JSON.stringify({ event: 'demo_login_failed' }))
    return json({ error: 'unauthorized' }, 401)
  }
  if (await ensureDemo(db))
    await recordAudit(db, {
      event: 'demo_created',
      userId: demoUserId,
      sessionKind: 'demo',
      ip,
    })
  const token = await createSession(db, demoUserId, 'demo')
  await recordAudit(db, {
    event: 'login_success',
    userId: demoUserId,
    sessionKind: 'demo',
    ip,
  })
  return json({ status: 'complete' }, 200, {
    'set-cookie': `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${String(webSeconds)}`,
  })
}

// The demo account's deletion (Apple 5.1.1(v)), confirmed with the password. It takes the demo
// organisation with it, an exception to the last-Ägare rule; the next demo login rebuilds both.
export async function deleteDemoAccount(
  request: Request,
  db: Kysely<DB> = getDb(),
) {
  const session = await authenticateSession(db, request)
  if (session?.kind !== 'demo') return json({ error: 'unauthorized' }, 401)
  const ip = clientIp(request)
  const input = z
    .object({ password: z.string() })
    .safeParse(await request.json().catch(() => null))
  if (!input.success || !ip) return json({ error: 'bad_request' }, 400)
  if (throttled(ip)) return json({ error: 'too_many_attempts' }, 429)
  if (
    !(await verifyPassword(input.data.password, process.env.DEMO_PASSWORD_HASH))
  ) {
    fail(ip)
    return json({ error: 'unauthorized' }, 401)
  }
  await db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext('demo'))`.execute(trx)
    await removeDemo(trx)
  })
  await recordAudit(db, {
    event: 'account_deleted',
    userId: demoUserId,
    sessionKind: 'demo',
    ip,
  })
  return json(null, 204, {
    'set-cookie': `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`,
  })
}

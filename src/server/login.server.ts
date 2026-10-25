import { randomBytes, randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { collect, pendingMessage } from './auth/bankid.server'
import { clientIp, recordAudit, truncate } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import {
  clearLogin,
  cookie,
  deviceCookie,
  drop,
  failed,
  loginCookie,
  refused,
  respond,
} from './login.reply.server'
import { deleteUser } from './members.server'
import {
  pendingReply,
  placeOrder,
  qrStep,
  remainingSql,
} from './login.order.server'
import { hashNetwork, hashPnr } from './pii.server'
import {
  cookieName,
  cookieValue,
  createSession,
  webSeconds,
} from './session.server'

const collectSeconds = 2

const startBody = z.object({
  sameDevice: z.boolean(),
  purpose: z.enum(['login', 'delete']).default('login'),
})

const noAccount = 'Det finns inget konto för det här BankID:t.'
const soleOwner =
  'Du är enda Ägare i en organisation. Ge rollen Ägare till någon annan först, sedan kan du radera kontot.'

const maxStarts = 20
const startWindowMs = 15 * 60 * 1000

// Each start places a BankID order, so the audit rows of recent starts from the caller's network are the count;
// a restart or a second instance keeps it (same approach as the demo login).
async function tooManyStarts(db: Kysely<DB>, ip: string) {
  const { n } = await db
    .selectFrom('audit_events')
    .select((eb) => eb.fn.countAll<string>().as('n'))
    .where('event', '=', 'login_started')
    .where('ip', '=', truncate(ip))
    .where('at', '>', new Date(Date.now() - startWindowMs))
    .executeTakeFirstOrThrow()
  return Number(n) >= maxStarts
}

export async function start(request: Request, db: Kysely<DB> = getDb()) {
  const body = startBody.safeParse(await request.json().catch(() => null))
  const ip = clientIp(request)
  if (!body.success || !ip) return respond({ error: 'bad_request' }, [], 400)
  if (await tooManyStarts(db, ip)) {
    console.warn(
      JSON.stringify({
        event: 'rate_limited',
        status: 429,
        route: 'bankid_start',
        key: hashNetwork(truncate(ip)),
      }),
    )
    return respond({ error: 'too_many_attempts' }, [], 429)
  }
  await recordAudit(db, { event: 'login_started', sessionKind: 'web', ip })
  const previous = z.uuid().safeParse(cookieValue(request, loginCookie))
  if (previous.success) await drop(db, previous.data)

  const device = cookieValue(request, deviceCookie) ?? randomUUID()
  const nonce = body.data.sameDevice
    ? randomBytes(16).toString('base64url')
    : null
  const placed = await placeOrder(request, ip, device, nonce, body.data.purpose)
  if ('error' in placed) return respond({ error: placed.error }, [], 502)
  const { order } = placed
  const row = await db
    .insertInto('login_attempts')
    .values({
      order_ref: order.orderRef,
      qr_start_token: order.qrStartToken,
      qr_start_secret: order.qrStartSecret,
      nonce,
      purpose: body.data.purpose,
      end_user_ip: ip,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  // The nonce reaches only the returnUrl, never the tab that started the login.
  return respond(nonce ? { autoStartToken: order.autoStartToken } : {}, [
    cookie(loginCookie, row.id, 3600),
    cookie(deviceCookie, device, 365 * 24 * 3600),
  ])
}

const statusBody = z.object({ nonce: z.string().optional() })

function loadAttempt(db: Kysely<DB>, request: Request) {
  const id = z.uuid().safeParse(cookieValue(request, loginCookie))
  if (!id.success) return undefined
  return db
    .selectFrom('login_attempts')
    .selectAll()
    .select(sql<number>`extract(epoch from now() - order_at)::float8`.as('age'))
    .select(remainingSql.as('remaining'))
    .where('id', '=', id.data)
    .executeTakeFirst()
}

// BankID asks for a collect every two seconds at most; the client polls faster for new QR data.
const claimCollect = (db: Kysely<DB>, id: string) =>
  db
    .updateTable('login_attempts')
    .set({ last_collect_at: sql<Date>`now()` })
    .where('id', '=', id)
    .where((eb) =>
      eb.or([
        eb('last_collect_at', 'is', null),
        eb(
          'last_collect_at',
          '<',
          sql<Date>`now() - ${collectSeconds} * interval '1 second'`,
        ),
      ]),
    )
    .returning('id')
    .executeTakeFirst()

type Attempt = NonNullable<Awaited<ReturnType<typeof loadAttempt>>>
type Done = Extract<Awaited<ReturnType<typeof collect>>, { status: 'complete' }>

// The person has just proved with BankID who they are, so the account behind that identity goes at once;
// sessions go with it (cascade). Bookkeeping records will reference users.id and decide what stays (docs/privacy/records.md).
async function deleteAccount(db: Kysely<DB>, row: Attempt, result: Done) {
  const deleted = await db.transaction().execute(async (trx) => {
    const user = await trx
      .selectFrom('users')
      .select('id')
      .where('pnr_hmac', '=', hashPnr(result.personalNumber))
      .executeTakeFirst()
    if (!user) return 'no_account'
    if (!(await deleteUser(trx, user.id))) return 'sole_owner'
    await recordAudit(trx, {
      event: 'account_deleted',
      userId: user.id,
      ip: row.end_user_ip,
    })
    await trx.deleteFrom('login_attempts').where('id', '=', row.id).execute()
    return 'deleted'
  })
  if (deleted === 'no_account') return failed(db, row, noAccount)
  if (deleted === 'sole_owner') return failed(db, row, soleOwner)
  return respond({ status: 'complete' }, [
    cookie(cookieName, '', 0),
    clearLogin,
  ])
}

// Only the tab BankID returns to, holding the nonce, may finish a same-device login. The starting tab
// is told `complete` without a session and the attempt stays for the return tab; it then reloads /app,
// which has the cookie only in the browser that really logged in.
// A completed order becomes a session only if BankID rated the risk below high and, for a same-device
// login, saw our client's IP and the browser came back with the nonce from the returnUrl. In a QR login
// BankID reports the scanning phone's IP, which is rightly not the browser's, so it is not compared.
async function complete(
  db: Kysely<DB>,
  row: Attempt,
  result: Done,
  nonce: string | undefined,
) {
  if (row.nonce !== null && nonce === undefined) {
    return respond({ status: 'complete' }, [])
  }
  const sameBrowser = row.nonce === null || nonce === row.nonce
  const sameIp = row.nonce === null || result.ip === row.end_user_ip
  if (!sameIp || result.risk === 'high' || !sameBrowser) {
    return failed(db, row, refused)
  }
  if (row.purpose === 'delete') return deleteAccount(db, row, result)
  const user = await db
    .insertInto('users')
    .values({ pnr_hmac: hashPnr(result.personalNumber), name: result.name })
    .onConflict((oc) =>
      oc.column('pnr_hmac').doUpdateSet({ name: result.name }),
    )
    .returning('id')
    .executeTakeFirstOrThrow()
  const token = await createSession(db, user.id, 'web')
  await recordAudit(db, {
    event: 'login_success',
    userId: user.id,
    sessionKind: 'web',
    ip: row.end_user_ip,
  })
  await db.deleteFrom('login_attempts').where('id', '=', row.id).execute()
  return respond({ status: 'complete' }, [
    cookie(cookieName, token, webSeconds),
    clearLogin,
  ])
}

export async function pollLogin(request: Request, db: Kysely<DB> = getDb()) {
  const row = await loadAttempt(db, request)
  if (!row) return respond({ error: 'no_attempt' }, [], 404)
  const pending = (message: string) => pendingReply(row, row.age, message)
  if (!(await claimCollect(db, row.id))) return pending('')

  // A network error or timeout says nothing about the order, so the attempt stays and the client polls again.
  const result = await collect(row.order_ref, row.nonce !== null).catch(
    () => undefined,
  )
  if (!result)
    return pending(pendingMessage('outstandingTransaction', row.nonce !== null))
  const next = await qrStep(request, db, row, result)
  if (next) return next
  if (result.status === 'pending') return pending(result.message)
  if (result.status !== 'complete') return failed(db, row, result.message)
  const body = statusBody.safeParse(await request.json().catch(() => ({})))
  if (!body.success) return failed(db, row, refused)
  return complete(db, row, result, body.data.nonce)
}

export async function cancelLogin(request: Request, db: Kysely<DB> = getDb()) {
  const id = z.uuid().safeParse(cookieValue(request, loginCookie))
  if (id.success) await drop(db, id.data)
  return respond(null, [clearLogin])
}

// Login attempts are meant to last seconds. The sweep runs every 15 minutes, so none outlives an hour.
export async function deleteStaleLoginAttempts(db: Kysely<DB>) {
  const { numDeletedRows } = await db
    .deleteFrom('login_attempts')
    .where('created_at', '<', sql<Date>`now() - interval '30 minutes'`)
    .executeTakeFirstOrThrow()
  return Number(numDeletedRows)
}

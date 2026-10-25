import { randomBytes, randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { publicUrl } from '#/api/csrf'
import {
  auth,
  bankidMode,
  cancel,
  collect,
  messageFor,
  pendingMessage,
  qrData,
} from './auth/bankid.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import { hashPnr } from './pii.server'
import {
  cookieName,
  cookieValue,
  createSession,
  webSeconds,
} from './session.server'

const loginCookie = '__Host-login'
const deviceCookie = '__Host-device'
const orderSeconds = 30
const collectSeconds = 2
const clearLogin = `${loginCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
const refused = 'Något gick fel. Försök igen.' // RFA22

const cookie = (name: string, value: string, maxAge?: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${maxAge === undefined ? '' : `; Max-Age=${String(maxAge)}`}`

const respond = (body: object | null, cookies: string[], status = 200) => {
  const headers = new Headers()
  for (const c of cookies) headers.append('set-cookie', c)
  if (body === null) return new Response(null, { status: 204, headers })
  headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

// The proxy appends the address it saw to X-Forwarded-For, so the last entry is the one to trust.
// Without a proxy (fake mode only) the connection is local.
function clientIp(request: Request) {
  const last = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
  return last || (bankidMode() === 'fake' ? '127.0.0.1' : undefined)
}

// Removes the attempt and cancels its order at BankID, which may already be over.
async function drop(db: Kysely<DB>, id: string) {
  const row = await db
    .deleteFrom('login_attempts')
    .where('id', '=', id)
    .returning('order_ref')
    .executeTakeFirst()
  if (row) await cancel(row.order_ref).catch(() => undefined)
}

async function failed(db: Kysely<DB>, id: string, message: string) {
  await drop(db, id)
  return respond({ status: 'failed', message }, [clearLogin])
}

const startBody = z.object({ sameDevice: z.boolean() })

const placeOrder = (
  request: Request,
  ip: string,
  device: string,
  nonce: string | null,
) =>
  auth(ip, {
    web: {
      referringDomain: new URL(publicUrl()).hostname,
      userAgent: request.headers.get('user-agent') ?? '',
      deviceIdentifier: device,
    },
    ...(nonce && {
      returnUrl: `${publicUrl()}/app/login/return#nonce=${nonce}`,
    }),
  }).then(
    (order) => ({ order }),
    (e: unknown) => ({ error: e instanceof Error ? e.message : '' }),
  )

export async function start(request: Request, db: Kysely<DB> = getDb()) {
  const body = startBody.safeParse(await request.json().catch(() => null))
  const ip = clientIp(request)
  if (!body.success || !ip) return respond({ error: 'bad_request' }, [], 400)
  const previous = z.uuid().safeParse(cookieValue(request, loginCookie))
  if (previous.success) await drop(db, previous.data)

  const device = cookieValue(request, deviceCookie) ?? randomUUID()
  const nonce = body.data.sameDevice
    ? randomBytes(16).toString('base64url')
    : null
  const placed = await placeOrder(request, ip, device, nonce)
  if ('error' in placed) {
    // RFA4 is the only BankID error the user can act on; anything else is RFA22.
    const known = messageFor('alreadyInProgress')
    const error = placed.error === known ? known : messageFor(undefined)
    return respond({ error }, [], 502)
  }
  const { order } = placed
  const row = await db
    .insertInto('login_attempts')
    .values({
      order_ref: order.orderRef,
      qr_start_token: order.qrStartToken,
      qr_start_secret: order.qrStartSecret,
      nonce,
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
    .select(sql<number>`extract(epoch from now() - created_at)`.as('age'))
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
    return failed(db, row.id, refused)
  }
  const user = await db
    .insertInto('users')
    .values({ pnr_hmac: hashPnr(result.personalNumber), name: result.name })
    .onConflict((oc) =>
      oc.column('pnr_hmac').doUpdateSet({ name: result.name }),
    )
    .returning('id')
    .executeTakeFirstOrThrow()
  const token = await createSession(db, user.id, 'web')
  await db.deleteFrom('login_attempts').where('id', '=', row.id).execute()
  return respond({ status: 'complete' }, [
    cookie(cookieName, token, webSeconds),
    clearLogin,
  ])
}

export async function pollLogin(request: Request, db: Kysely<DB> = getDb()) {
  const row = await loadAttempt(db, request)
  if (!row) return respond({ error: 'no_attempt' }, [], 404)
  // BankID ends an unscanned order itself; we only stop offering QR data after 30 seconds and never cancel a login being signed.
  const pending = (message: string) => {
    const qr =
      row.nonce === null && row.age < orderSeconds
        ? qrData(row.qr_start_token, row.qr_start_secret, Math.floor(row.age))
        : undefined
    return respond({ status: 'pending', message, ...(qr && { qr }) }, [])
  }
  if (!(await claimCollect(db, row.id))) return pending('')

  // A network error or timeout says nothing about the order, so the attempt stays and the client polls again.
  const result = await collect(row.order_ref, row.nonce !== null).catch(
    () => undefined,
  )
  if (!result)
    return pending(pendingMessage('outstandingTransaction', row.nonce !== null))
  if (result.status === 'pending') return pending(result.message)
  if (result.status !== 'complete') return failed(db, row.id, result.message)
  const body = statusBody.safeParse(await request.json().catch(() => ({})))
  if (!body.success) return failed(db, row.id, refused)
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

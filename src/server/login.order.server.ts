import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { z } from 'zod'
import { publicUrl } from '#/api/csrf'
import {
  auth,
  cancel,
  failedMessage,
  messageFor,
  pendingMessage,
  qrData,
} from './auth/bankid.server'
import type { collect } from './auth/bankid.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import {
  deviceCookie,
  failed,
  loginCookie,
  respond,
} from './login.reply.server'
import { cookieValue } from './session.server'

// BankID orders last 30 seconds; a QR login places the next one a few seconds early (docs/plans/IRM-161.md).
const renewSeconds = 25
const deleteText = 'Bekräfta att du vill radera ditt konto'
// Seconds left of the QR display, rounded up and never below zero.
export const remainingSql = sql<number>`greatest(0, ceil(extract(epoch from qr_until - now())))::float8`

export const placeOrder = (
  request: Request,
  ip: string,
  device: string,
  nonce: string | null,
  purpose: 'login' | 'delete',
) =>
  auth(ip, {
    ...(purpose === 'delete' && { userVisibleData: deleteText }),
    web: {
      referringDomain: new URL(publicUrl()).hostname,
      userAgent: request.headers.get('user-agent') ?? '',
      deviceIdentifier: device,
    },
    ...(nonce && {
      returnUrl: `${publicUrl()}/app/login/return?purpose=${purpose}#nonce=${nonce}`,
    }),
  }).then(
    (order) => ({ order }),
    // RFA4 is the only BankID error the user can act on; anything else is RFA22.
    (e: unknown) => {
      const known = messageFor('alreadyInProgress')
      return {
        error:
          e instanceof Error && e.message === known
            ? known
            : messageFor(undefined),
      }
    },
  )

type QrRow = {
  id: string
  order_ref: string
  nonce: string | null
  purpose: string
  end_user_ip: string
  qr_start_token: string
  qr_start_secret: string
  age: number
  remaining: number
}

// A QR login gets the QR data for this second and how many seconds of QR display remain.
export const pendingReply = (row: QrRow, age: number, message: string) =>
  respond(
    {
      status: 'pending',
      message,
      ...(row.nonce === null &&
        row.remaining > 0 && {
          qr: qrData(row.qr_start_token, row.qr_start_secret, Math.floor(age)),
          remaining: row.remaining,
        }),
    },
    [],
  )

// Places the next order of an unscanned QR login, then cancels the one it replaces.
async function renew(request: Request, db: Kysely<DB>, row: QrRow) {
  const device = cookieValue(request, deviceCookie) ?? randomUUID()
  const purpose = row.purpose === 'delete' ? 'delete' : 'login'
  const placed = await placeOrder(
    request,
    row.end_user_ip,
    device,
    null,
    purpose,
  )
  if ('error' in placed) return failed(db, row, placed.error)
  const { order } = placed
  const next = await db
    .updateTable('login_attempts')
    .set({
      order_ref: order.orderRef,
      qr_start_token: order.qrStartToken,
      qr_start_secret: order.qrStartSecret,
      order_at: sql<Date>`now()`,
      last_collect_at: null,
    })
    .where('id', '=', row.id)
    .returningAll()
    .executeTakeFirst()
  await cancel(next ? row.order_ref : order.orderRef).catch(() => undefined)
  if (!next) return respond({ error: 'no_attempt' }, [], 404)
  return pendingReply(
    { ...next, age: 0, remaining: row.remaining },
    0,
    pendingMessage('outstandingTransaction', false),
  )
}

// Only a QR order nobody has scanned is replaced or ended; a login being signed always runs to its end.
export async function qrStep(
  request: Request,
  db: Kysely<DB>,
  row: QrRow,
  result: Awaited<ReturnType<typeof collect>>,
) {
  if (row.nonce !== null || result.status === 'complete') return undefined
  const waiting =
    result.status === 'pending' ? 'outstandingTransaction' : 'startFailed'
  if (result.hint !== waiting) return undefined
  if (row.remaining <= 0)
    return failed(db, row, failedMessage('startFailed', false))
  if (result.status === 'failed' || row.age >= renewSeconds)
    return renew(request, db, row)
  return undefined
}

// "Mer tid": the QR display runs five more minutes, but never past the 30 minutes an attempt may live.
export async function extendLogin(request: Request, db: Kysely<DB> = getDb()) {
  const id = z.uuid().safeParse(cookieValue(request, loginCookie))
  if (!id.success) return respond({ error: 'no_attempt' }, [], 404)
  const row = await db
    .updateTable('login_attempts')
    .set({
      qr_until: sql<Date>`least(now() + interval '5 minutes', created_at + interval '30 minutes')`,
    })
    .where('id', '=', id.data)
    .where('nonce', 'is', null)
    .returning(remainingSql.as('remaining'))
    .executeTakeFirst()
  if (!row) return respond({ error: 'no_attempt' }, [], 404)
  return respond({ remaining: row.remaining }, [])
}

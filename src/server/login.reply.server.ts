import type { Kysely } from 'kysely'
import { cancel } from './auth/bankid.server'
import { recordAudit } from './audit.server'
import type { DB } from './db.gen'

// The cookies and replies the BankID login endpoints share.
export const loginCookie = '__Host-login'
export const deviceCookie = '__Host-device'
export const clearLogin = `${loginCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
export const refused = 'Något gick fel. Försök igen.' // RFA22

export const cookie = (name: string, value: string, maxAge?: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict${maxAge === undefined ? '' : `; Max-Age=${String(maxAge)}`}`

export const respond = (
  body: object | null,
  cookies: string[],
  status = 200,
) => {
  const headers = new Headers()
  for (const c of cookies) headers.append('set-cookie', c)
  if (body === null) return new Response(null, { status: 204, headers })
  headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

// Removes the attempt and cancels its order at BankID, which may already be over.
export async function drop(db: Kysely<DB>, id: string) {
  const row = await db
    .deleteFrom('login_attempts')
    .where('id', '=', id)
    .returning('order_ref')
    .executeTakeFirst()
  if (row) await cancel(row.order_ref).catch(() => undefined)
}

export async function failed(
  db: Kysely<DB>,
  row: { id: string; end_user_ip: string },
  message: string,
) {
  await drop(db, row.id)
  await recordAudit(db, {
    event: 'login_failure',
    sessionKind: 'web',
    ip: row.end_user_ip,
  })
  return respond({ status: 'failed', message }, [clearLogin])
}

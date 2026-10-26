import { isIPv4, isIPv6 } from 'node:net'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { bankidMode } from './auth/bankid.server'
import type { DB } from './db.gen'
import { log, note } from './log.server'

// The proxy appends the address it saw to X-Forwarded-For, so the last entry is the one to trust.
// Without a proxy (fake mode only) the connection is local.
export function clientIp(request: Request) {
  const last = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()
  return last || (bankidMode() === 'fake' ? '127.0.0.1' : undefined)
}

// Keeps the network, drops the host: IPv4 /24, IPv6 up to /48 (an address with `::` early keeps fewer groups).
export function truncate(ip: string | undefined) {
  if (ip && isIPv4(ip)) return `${ip.split('.').slice(0, 3).join('.')}.0`
  if (ip && isIPv6(ip))
    return `${ip.split(':').slice(0, 3).filter(Boolean).join(':')}::`
  return null
}

export type AuditEvent = {
  event:
    | 'login_success'
    | 'login_failure'
    | 'login_started'
    | 'logout'
    | 'organisation_created'
    | 'member_added'
    | 'member_role_changed'
    | 'member_removed'
    | 'member_left'
    | 'invite_created'
    | 'invite_accepted'
    | 'invite_revoked'
    | 'role_created'
    | 'role_updated'
    | 'role_deleted'
    | 'company_updated'
    | 'customer_created'
    | 'customer_updated'
    | 'customer_deleted'
    | 'customers_imported'
    | 'document_uploaded'
    | 'receipt_added'
    | 'receipt_updated'
    | 'receipt_match_decided'
    | 'receipt_suggestions_changed'
    | 'bank_account_created'
    | 'bank_statement_imported'
    | 'authorization_refused'
    | 'account_deleted'
    | 'data_exported'
    | 'demo_created'
    | 'mcp_tool_called'
  userId?: string
  sessionKind?: string
  ip?: string
  // Never a personal identity number, token or name.
  detail?: Record<string, string | number | boolean>
}

// The audit events OWASP also wants in the application log (docs/observability.md), with the level they log at.
function logged(e: AuditEvent) {
  const user = { user_id: e.userId }
  if (e.event === 'login_success') {
    note({ ...user, outcome: 'ok' })
    log('info', 'login', {
      outcome: 'ok',
      session_kind: e.sessionKind,
      ...user,
    })
  } else if (e.event === 'login_failure') {
    note({ outcome: 'failed' })
    log('warn', 'login', { outcome: 'failed', session_kind: e.sessionKind })
  } else if (e.event === 'authorization_refused') {
    note({ outcome: 'denied' })
    log('warn', 'access_denied', { outcome: 'denied', ...user })
  }
}

export const recordAudit = (db: Kysely<DB>, e: AuditEvent) => {
  logged(e)
  return db
    .insertInto('audit_events')
    .values({
      event: e.event,
      user_id: e.userId ?? null,
      session_kind: e.sessionKind ?? null,
      ip: truncate(e.ip),
      detail: JSON.stringify(e.detail ?? {}),
      hash: Buffer.alloc(0), // the chain trigger replaces it
    })
    .execute()
}

// Retention: 12 months (proposed in docs/privacy/records.md).
export const deleteExpiredAuditEvents = (db: Kysely<DB>) =>
  db.transaction().execute(async (trx) => {
    await sql`select set_config('audit.retention', 'on', true)`.execute(trx)
    const { numDeletedRows } = await trx
      .deleteFrom('audit_events')
      .where('at', '<', sql<Date>`now() - interval '12 months'`)
      .executeTakeFirstOrThrow()
    return Number(numDeletedRows)
  })

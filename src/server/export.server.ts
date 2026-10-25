import type { Kysely } from 'kysely'
import { clientIp, recordAudit } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import { authenticate, unauthorized } from './session.server'

const personalIdentityNumber = {
  stored:
    'Vi lagrar aldrig ditt personnummer, bara en nyckelad hash (HMAC-SHA256) som gör att vi känner igen dig vid nästa inloggning. Hashen är fortfarande en personuppgift men lämnas inte ut här.',
}

// GDPR Art. 15 and 20: only the signed-in user's own rows, never a token or a hash value (Art. 15(4)).
export async function exportData(request: Request, db?: Kysely<DB>) {
  const id = await authenticate(db, request)
  if (!id) return unauthorized()
  const conn = db ?? getDb()
  const account = await conn
    .selectFrom('users')
    .select(['id', 'name', 'created_at'])
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  const sessions = await conn
    .selectFrom('sessions')
    .select(['kind', 'created_at', 'expires_at', 'last_used_at', 'revoked_at'])
    .where('user_id', '=', id)
    .orderBy('created_at')
    .execute()
  await recordAudit(conn, {
    event: 'data_exported',
    userId: id,
    ip: clientIp(request),
  })
  const audit_events = await conn
    .selectFrom('audit_events')
    .select(['at', 'event', 'session_kind', 'ip', 'detail'])
    .where('user_id', '=', id)
    .orderBy('id')
    .execute()
  return new Response(
    JSON.stringify(
      {
        account,
        personal_identity_number: personalIdentityNumber,
        sessions,
        audit_events,
      },
      null,
      2,
    ),
    {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': 'attachment; filename="mina-uppgifter.json"',
        'cache-control': 'no-store',
      },
    },
  )
}

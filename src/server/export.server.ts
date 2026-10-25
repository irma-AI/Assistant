import type { Kysely } from 'kysely'
import { clientIp, recordAudit } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import { authenticate, unauthorized } from './session.server'

// Art. 15(1)(a)-(h) information, kept next to the data it describes. Mirrors docs/privacy/records.md.
const aboutThisExport = {
  controller:
    'Se docs/privacy/records.md; kontaktuppgift: [PLACEHOLDER, ägaren fyller i under IRM-54]',
  purposes:
    'Identifiera dig som kontoinnehavare, hålla dig inloggad, förhindra missbruk och visa vem som har gjort vad (säkerhetslogg).',
  recipients:
    'HostUp (server i Sverige). BankID:s bank behandlar inloggningen som egen personuppgiftsansvarig.',
  retention:
    'Konto: tills du raderar det. Webbsessioner 12 timmar, appsessioner 90 dagar, avslutade sessioner raderas efter 30 dagar. Säkerhetslogg: 12 månader.',
  your_rights:
    'Rättelse, radering ("Radera mitt konto" i appen), begränsning, invändning och klagomål till Integritetsskyddsmyndigheten (IMY).',
  source: 'Uppgifterna kommer från dig och från BankID vid inloggning.',
  not_included:
    'Bokföringsuppgifter hör till din organisation, som är personuppgiftsansvarig för dem. Vänd dig dit; vi hjälper organisationen att svara.',
  fields: {
    account:
      'id: internt konto-id; name: namn från BankID; created_at: när kontot skapades.',
    sessions:
      'kind: web, app eller demo; created_at, expires_at, last_used_at, revoked_at: tider för sessionen. Själva sessionsnyckeln finns inte med.',
    audit_events:
      'at: tid; event: händelse (inloggning, utloggning, utlämning av uppgifter); session_kind: sessionstyp; ip: IP-adress avkortad till nätverket; detail: extra uppgifter om händelsen.',
  },
}

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
        about_this_export: aboutThisExport,
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

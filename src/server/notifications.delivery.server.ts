import { sql } from 'kysely'
import type { Kysely, Updateable } from 'kysely'
import { publicUrl } from '#/api/csrf'
import { eventTypes, isEventType, noticeText } from '#/api/notifications'
import type { DB } from './db.gen'
import type { Send } from './email.server'
import { unsubscribeSignature } from './notifications.server'
import { inOrganisation } from './tenant.server'

const maxAttempts = 3

type Due = Awaited<ReturnType<typeof due>>[number]

const due = (trx: Kysely<DB>, orgId: string) =>
  trx
    .selectFrom('notification_deliveries as d')
    .innerJoin('notification_events as e', 'e.id', 'd.event_id')
    .innerJoin('users as u', 'u.id', 'd.user_id')
    .leftJoin('notification_preferences as p', (j) =>
      j.onRef('p.user_id', '=', 'd.user_id').onRef('p.type', '=', 'e.type'),
    )
    .where('d.organisation_id', '=', orgId)
    .where('d.sent_at', 'is', null)
    .where('d.failed_at', 'is', null)
    .where('d.next_attempt_at', '<=', sql<Date>`now()`)
    .select([
      'd.event_id',
      'd.user_id',
      'd.attempts',
      'e.type',
      'e.payload',
      'u.email',
      'u.email_verified_at',
      'p.email as pref',
    ])
    .limit(100)
    .forUpdate('d')
    .skipLocked()
    .execute()

// Why this delivery must not be sent now, checked again at send time: the address may have changed or the email
// been turned off since the event was recorded.
function skipReason(d: Due) {
  if (!isEventType(d.type)) return 'UNKNOWN_TYPE'
  if (!d.email || !d.email_verified_at) return 'UNCONFIRMED'
  if (!eventTypes[d.type].mandatory && d.pref === false) return 'OPTED_OUT'
  return null
}

const unsubscribeLink = (userId: string, type: string) =>
  `${publicUrl()}/api/v1/notifications/unsubscribe?${new URLSearchParams({
    user: userId,
    type,
    sig: unsubscribeSignature(userId, type),
  }).toString()}`

// A short code only: the server's own message can name the address.
const errorCode = (e: unknown) =>
  typeof e === 'object' && e && 'code' in e && typeof e.code === 'string'
    ? e.code.slice(0, 100)
    : 'SEND_FAILED'

const save = (
  trx: Kysely<DB>,
  d: Due,
  set: Updateable<DB['notification_deliveries']>,
) =>
  trx
    .updateTable('notification_deliveries')
    .set(set)
    .where('event_id', '=', d.event_id)
    .where('user_id', '=', d.user_id)
    .execute()

async function deliver(trx: Kysely<DB>, d: Due, send: Send) {
  const reason = skipReason(d)
  if (reason || !d.email || !isEventType(d.type))
    return save(trx, d, { failed_at: new Date(), last_error: reason })
  const notice = noticeText(d.type, d.payload)
  const unsubscribe = eventTypes[d.type].mandatory
    ? undefined
    : unsubscribeLink(d.user_id, d.type)
  const off = unsubscribe
    ? `\n\nVill du inte få mejl om det här? Stäng av dem: ${unsubscribe}`
    : ''
  try {
    await send({
      to: d.email,
      subject: notice.title,
      text: `${notice.body}\n\nÖppna appen för att läsa mer.${off}`,
      unsubscribe,
    })
    await save(trx, d, { sent_at: new Date(), attempts: d.attempts + 1 })
  } catch (e) {
    const attempts = d.attempts + 1
    await save(trx, d, {
      attempts,
      last_error: errorCode(e),
      ...(attempts >= maxAttempts
        ? { failed_at: new Date() }
        : {
            next_attempt_at: new Date(Date.now() + attempts * 60_000),
          }),
    })
  }
}

// The background job: sends every email that is due, organisation by organisation so row level security applies.
// A failure is tried again a little later, and the third failure is kept on the delivery as failed_at and last_error.
// Delivery is at least once: a crash between sending and saving sends the email again.
export async function deliverEmails(db: Kysely<DB>, send: Send) {
  const orgs = await db.selectFrom('organisations').select('id').execute()
  for (const org of orgs)
    await inOrganisation(db, org.id, async (trx) => {
      for (const d of await due(trx, org.id)) await deliver(trx, d, send)
    })
}

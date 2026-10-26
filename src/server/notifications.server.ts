import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { publicUrl } from '#/api/csrf'
import { eventTypes, isEventType, noticeText } from '#/api/notifications'
import type { EventType } from '#/api/notifications'
import { effective, HttpError, access } from './access.server'
import type { DB } from './db.gen'
import type { Send } from './email.server'
import { hmacPnr } from './pii.server'
import { inOrganisation } from './tenant.server'

const hash = (token: string) => createHash('sha256').update(token).digest()

// --- Events and in-app notices ---

// Records an event and queues one email per member who may see it, has a confirmed address and has not turned that
// email off (a mandatory type ignores the preference). Call inside inOrganisation, in the transaction of whatever
// happened, so the event exists only if it did.
export async function createEvent(
  trx: Kysely<DB>,
  orgId: string,
  type: EventType,
  payload: Record<string, string>,
) {
  const event = await trx
    .insertInto('notification_events')
    .values({ organisation_id: orgId, type, payload: JSON.stringify(payload) })
    .returning('id')
    .executeTakeFirstOrThrow()
  const type_ = eventTypes[type]
  const members = await trx
    .selectFrom('memberships')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .innerJoin('users', 'users.id', 'memberships.user_id')
    .leftJoin('notification_preferences as p', (j) =>
      j.onRef('p.user_id', '=', 'users.id').on('p.type', '=', type),
    )
    .where('memberships.organisation_id', '=', orgId)
    .where('users.email_verified_at', 'is not', null)
    .select(['users.id', 'roles.kind', 'roles.permissions', 'p.email as pref'])
    .execute()
  const to = members.filter(
    (m) =>
      effective(m).includes(type_.permission) &&
      (type_.mandatory || m.pref !== false),
  )
  if (to.length)
    await trx
      .insertInto('notification_deliveries')
      .values(
        to.map((m) => ({
          event_id: event.id,
          organisation_id: orgId,
          user_id: m.id,
        })),
      )
      .execute()
  return event.id
}

const seen = (permissions: string[]) =>
  Object.entries(eventTypes)
    .filter(([, t]) => permissions.some((p) => p === t.permission))
    .map(([name]) => name)

// The newest notices of the types this member's permissions allow; an organisation's other members' roles don't matter.
export const listNotices = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    const a = await access(trx, userId, orgId)
    const types = seen(a.permissions)
    if (!types.length) return []
    const rows = await trx
      .selectFrom('notification_events as e')
      .leftJoin('notification_reads as r', (j) =>
        j.onRef('r.event_id', '=', 'e.id').on('r.user_id', '=', userId),
      )
      .where('e.organisation_id', '=', orgId)
      .where('e.type', 'in', types)
      .select(['e.id', 'e.type', 'e.payload', 'e.created_at', 'r.read_at'])
      .orderBy('e.created_at', 'desc')
      .orderBy('e.id')
      .limit(100)
      .execute()
    return rows.flatMap((r) =>
      isEventType(r.type)
        ? [
            {
              id: r.id,
              ...noticeText(r.type, r.payload),
              created_at: r.created_at,
              read: r.read_at !== null,
            },
          ]
        : [],
    )
  })

export const markRead = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  eventId: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    const a = await access(trx, userId, orgId)
    const types = seen(a.permissions)
    if (!types.length) throw new HttpError(404, 'not_found')
    const event = await trx
      .selectFrom('notification_events')
      .select('id')
      .where('id', '=', eventId)
      .where('organisation_id', '=', orgId)
      .where('type', 'in', types)
      .executeTakeFirst()
    if (!event) throw new HttpError(404, 'not_found')
    await trx
      .insertInto('notification_reads')
      .values({ event_id: eventId, organisation_id: orgId, user_id: userId })
      .onConflict((c) => c.columns(['event_id', 'user_id']).doNothing())
      .execute()
  })

// --- Preferences ---

export async function listPreferences(db: Kysely<DB>, userId: string) {
  const rows = await db
    .selectFrom('notification_preferences')
    .select(['type', 'email'])
    .where('user_id', '=', userId)
    .execute()
  return Object.entries(eventTypes).map(([type, t]) => ({
    type,
    label: t.label,
    mandatory: t.mandatory,
    email: t.mandatory || (rows.find((r) => r.type === type)?.email ?? true),
  }))
}

export async function setPreference(
  db: Kysely<DB>,
  userId: string,
  type: string,
  email: boolean,
) {
  if (!isEventType(type)) throw new HttpError(404, 'not_found')
  if (eventTypes[type].mandatory) throw new HttpError(400, 'mandatory', false)
  await db
    .insertInto('notification_preferences')
    .values({ user_id: userId, type, email })
    .onConflict((c) => c.columns(['user_id', 'type']).doUpdateSet({ email }))
    .execute()
}

export const unsubscribeSignature = (userId: string, type: string) => {
  const key = process.env.PII_HASH_KEY
  if (!key) throw new Error('PII_HASH_KEY is not set')
  return hmacPnr(`unsubscribe:${userId}:${type}`, key).toString('hex')
}

// shortcut: a GET unsubscribes at once, so a mail scanner that opens links can turn an email off; the person can
// turn it back on in settings. Upgrade to a confirm page if that happens.
export async function unsubscribe(
  db: Kysely<DB>,
  userId: string,
  type: string,
  signature: string,
) {
  const expected = Buffer.from(unsubscribeSignature(userId, type))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    throw new HttpError(400, 'invalid_link', false)
  await setPreference(db, userId, type, false)
}

// --- Email address ---

export async function getEmail(db: Kysely<DB>, userId: string) {
  const u = await db
    .selectFrom('users')
    .select(['email', 'email_verified_at'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  return { email: u.email, verified: u.email_verified_at !== null }
}

// Saves the address as unconfirmed and emails it a single-use link, valid for 24 hours. A new address clears the
// confirmation of the old one. shortcut: one confirmation a minute per user is the only limit on mail to a stranger's
// address; add a per-address limit if it is abused.
export async function setEmail(
  db: Kysely<DB>,
  userId: string,
  address: string,
  send: Send,
) {
  const email = address.toLowerCase()
  const token = randomBytes(32).toString('base64url')
  const changed = await db.transaction().execute(async (trx) => {
    const u = await trx
      .selectFrom('users')
      .select(['email', 'email_verified_at'])
      .where('id', '=', userId)
      .forUpdate()
      .executeTakeFirstOrThrow()
    if (u.email === email && u.email_verified_at) return false
    const recent = await trx
      .selectFrom('email_confirmations')
      .select('token_hash')
      .where('user_id', '=', userId)
      .where(
        'expires_at',
        '>',
        sql<Date>`now() + interval '23 hours 59 minutes'`,
      )
      .executeTakeFirst()
    if (recent) throw new HttpError(429, 'too_many', false)
    await trx
      .updateTable('users')
      .set({ email, email_verified_at: null })
      .where('id', '=', userId)
      .execute()
    await trx
      .deleteFrom('email_confirmations')
      .where('user_id', '=', userId)
      .execute()
    await trx
      .insertInto('email_confirmations')
      .values({
        token_hash: hash(token),
        user_id: userId,
        email,
        expires_at: sql<Date>`now() + interval '24 hours'`,
      })
      .execute()
    return true
  })
  if (!changed) return
  try {
    await send({
      to: email,
      subject: 'Bekräfta din e-postadress',
      text: `Du har angett den här adressen för aviseringar. Bekräfta den genom att öppna länken, som gäller i 24 timmar:\n\n${publicUrl()}/app/bekrafta-epost#${token}\n\nOm det inte var du kan du strunta i det här mejlet. Då skickas inga aviseringar hit.`,
    })
  } catch {
    throw new HttpError(502, 'email_failed', false)
  }
}

// One answer for a link that is unknown, expired, used or for an address since changed.
export async function confirmEmail(
  db: Kysely<DB>,
  userId: string,
  token: string,
) {
  const invalid = () => new HttpError(400, 'invalid_link', false)
  await db.transaction().execute(async (trx) => {
    const row = await trx
      .deleteFrom('email_confirmations')
      .where('token_hash', '=', hash(token))
      .where('user_id', '=', userId)
      .where('expires_at', '>', sql<Date>`now()`)
      .returning('email')
      .executeTakeFirst()
    if (!row) throw invalid()
    const done = await trx
      .updateTable('users')
      .set({ email_verified_at: sql<Date>`now()` })
      .where('id', '=', userId)
      .where('email', '=', row.email)
      .executeTakeFirst()
    if (!done.numUpdatedRows) throw invalid()
  })
}

// Events with their reads and deliveries go after 90 days (proposed in docs/privacy/records.md).
export async function deleteOldEvents(db: Kysely<DB>) {
  const orgs = await db.selectFrom('organisations').select('id').execute()
  for (const org of orgs)
    await inOrganisation(db, org.id, (trx) =>
      trx
        .deleteFrom('notification_events')
        .where('organisation_id', '=', org.id)
        .where('created_at', '<', sql<Date>`now() - interval '90 days'`)
        .execute(),
    )
}

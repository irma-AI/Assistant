import { sql } from 'kysely'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { noticePreferences, notices } from '#/api/schemas'
import type { EventType } from '#/api/notifications'
import type { Mail } from './email.server'
import { deleteUser } from './members.server'
import { notificationsApi, unsubscribe } from './notifications.api.server'
import { deliverEmails } from './notifications.delivery.server'
import { createEvent, deleteOldEvents, getEmail } from './notifications.server'
import { addMember, db, newOrg, person, req, useDatabase } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { inOrganisation } from './tenant.server'

useDatabase()

const event = (org: string, type: EventType = 'member_joined') =>
  inOrganisation(db, org, (trx) =>
    createEvent(trx, org, type, {
      name: 'Test Person',
      bank: 'Banken',
      date: '2026-12-01',
    }),
  )
const deliveries = (org: string) =>
  inOrganisation(db, org, (trx) =>
    trx
      .selectFrom('notification_deliveries')
      .select(['user_id', 'attempts', 'sent_at', 'failed_at', 'last_error'])
      .where('organisation_id', '=', org)
      .execute(),
  )
const confirmed = (p: Person, email: string) =>
  db
    .updateTable('users')
    .set({ email, email_verified_at: sql<Date>`now()` })
    .where('id', '=', p.id)
    .execute()
const inbox = async (p: Person, org: string) =>
  notices.parse(
    await (await notificationsApi.list(req(p, 'GET'), org, db)).json(),
  )
// Every mail the job sends, any organisation's; tests look at the ones for their own address.
const collect = () => {
  const sent: Mail[] = []
  return {
    sent,
    send: (m: Mail) => Promise.resolve(void sent.push(m)),
    to: (address: string) => sent.filter((m) => m.to === address),
  }
}
const setEmail = (p: Person, email: string, send: (m: Mail) => Promise<void>) =>
  notificationsApi.setEmail(req(p, 'PUT', { email }), db, send)

async function setup() {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  return { owner, org, member }
}

test('an event is listed only to members whose role holds its permission, and only inside its organisation', async () => {
  const { owner, org, member } = await setup()
  const outsider = await person()
  const other = (await newOrg(outsider)).id
  await event(org, 'member_joined')
  await event(org, 'bank_consent_expiring')
  const titles = (await inbox(owner, org)).map((n) => n.title)
  expect(titles).toHaveLength(2)
  expect(titles).toContain('Kopplingen till Banken går ut 2026-12-01')
  // Medlem holds no permission an event type names.
  expect(await inbox(member, org)).toEqual([])
  // Another organisation's owner is no member: not found, and its own list is empty.
  expect(
    (await notificationsApi.list(req(outsider, 'GET'), org, db)).status,
  ).toBe(404)
  expect(await inbox(outsider, other)).toEqual([])
  // Row level security alone, as the restricted role the app will log in as.
  const seen = await inOrganisation(db, other, async (trx) => {
    await sql`set local role assistant_app`.execute(trx)
    return trx.selectFrom('notification_events').select('id').execute()
  })
  expect(seen).toEqual([])
})

test('a member marks a notice read, and only a notice they may see', async () => {
  const { owner, org, member } = await setup()
  const id = await event(org)
  const read = (p: Person) =>
    notificationsApi.read(req(p, 'POST'), org, id, db).then((r) => r.status)
  expect(await read(owner)).toBe(204)
  expect((await inbox(owner, org))[0]?.read).toBe(true)
  expect(await read(member)).toBe(404)
})

test('a failed delivery is retried and the third failure is kept on the delivery', async () => {
  const { owner, org } = await setup()
  await confirmed(owner, 'agare@example.test')
  await event(org)
  let calls = 0
  const failing = () => {
    calls++
    return Promise.reject(
      Object.assign(new Error('to agare@example.test'), {
        code: 'ECONNECTION',
      }),
    )
  }
  const retryNow = () =>
    inOrganisation(db, org, (trx) =>
      trx
        .updateTable('notification_deliveries')
        .set({ next_attempt_at: sql<Date>`now() - interval '1 second'` })
        .execute(),
    )
  await deliverEmails(db, failing)
  // Not due again yet: the delay is a minute.
  await deliverEmails(db, failing)
  expect(calls).toBe(1)
  await retryNow()
  await deliverEmails(db, failing)
  await retryNow()
  await deliverEmails(db, failing)
  expect(calls).toBe(3)
  const [d] = await deliveries(org)
  expect(d).toMatchObject({
    attempts: 3,
    sent_at: null,
    last_error: 'ECONNECTION',
  })
  expect(d?.failed_at).toBeTruthy()
  // A recorded final failure is not tried again.
  await retryNow()
  await deliverEmails(db, failing)
  expect(calls).toBe(3)
})

test('an email goes only to a confirmed address; confirming, expiry, reuse and a changed address', async () => {
  const { owner, org } = await setup()
  await event(org)
  expect(await deliveries(org)).toEqual([])
  const mail = collect()
  expect((await setEmail(owner, 'Agare@Example.test', mail.send)).status).toBe(
    204,
  )
  expect(await getEmail(db, owner.id)).toEqual({
    email: 'agare@example.test',
    verified: false,
  })
  await event(org)
  expect(await deliveries(org)).toEqual([])
  // A second link within a minute is refused.
  expect((await setEmail(owner, 'agare@example.test', mail.send)).status).toBe(
    429,
  )

  const token = mail.sent[0]?.text.match(/#(\S+)/)?.[1] ?? ''
  const confirm = (t: string) =>
    notificationsApi
      .confirmEmail(req(owner, 'POST', { token: t }), db)
      .then((r) => r.status)
  expect(await confirm('x'.repeat(43))).toBe(400)
  expect(await confirm(token)).toBe(204)
  expect(await getEmail(db, owner.id)).toMatchObject({ verified: true })
  expect(await confirm(token)).toBe(400) // single use

  await event(org)
  expect(await deliveries(org)).toHaveLength(1)

  // An expired link is refused, and a new address clears the confirmation.
  await db
    .updateTable('users')
    .set({ email_verified_at: null })
    .where('id', '=', owner.id)
    .execute()
  await db.deleteFrom('email_confirmations').execute()
  const again = collect()
  await setEmail(owner, 'ny@example.test', again.send)
  await db
    .updateTable('email_confirmations')
    .set({ expires_at: sql<Date>`now() - interval '1 second'` })
    .execute()
  expect(await confirm(again.sent[0]?.text.match(/#(\S+)/)?.[1] ?? '')).toBe(
    400,
  )
  expect(await getEmail(db, owner.id)).toEqual({
    email: 'ny@example.test',
    verified: false,
  })
  await db.deleteFrom('email_confirmations').execute()
  const third = collect()
  await setEmail(owner, 'tredje@example.test', third.send)
  expect(await confirm(third.sent[0]?.text.match(/#(\S+)/)?.[1] ?? '')).toBe(
    204,
  )
  await setEmail(owner, 'fjarde@example.test', third.send)
  expect(await getEmail(db, owner.id)).toEqual({
    email: 'fjarde@example.test',
    verified: false,
  })
})

test('an address that is not confirmed when the job runs gets nothing', async () => {
  const { owner, org } = await setup()
  await confirmed(owner, 'uppsagd@example.test')
  await event(org)
  await db
    .updateTable('users')
    .set({ email_verified_at: null })
    .where('id', '=', owner.id)
    .execute()
  const mail = collect()
  await deliverEmails(db, mail.send)
  expect(mail.to('uppsagd@example.test')).toEqual([])
})

test('email turned off gives in-app only, and a mandatory type cannot be turned off', async () => {
  const { owner, org } = await setup()
  await confirmed(owner, 'agare@example.test')
  const put = (type: string, email: boolean) =>
    notificationsApi
      .setPreference(req(owner, 'PUT', { email }), type, db)
      .then((r) => r.status)
  expect(await put('member_joined', false)).toBe(204)
  expect(await put('bank_consent_expiring', false)).toBe(400)
  expect(await put('nonsense', false)).toBe(404)
  const prefs = noticePreferences.parse(
    await (await notificationsApi.preferences(req(owner, 'GET'), db)).json(),
  )
  // The owner also holds invoices.manage, so the invoice events follow.
  expect(prefs.map((p) => [p.type, p.email]).slice(0, 2)).toEqual([
    ['bank_consent_expiring', true],
    ['member_joined', false],
  ])
  await event(org, 'member_joined')
  expect(await deliveries(org)).toEqual([])
  expect(await inbox(owner, org)).toHaveLength(1)
  await event(org, 'bank_consent_expiring')
  expect(await deliveries(org)).toHaveLength(1)
})

test('every optional email carries an unsubscribe link that turns that email off; a mandatory one has none', async () => {
  const { owner, org } = await setup()
  const address = `${owner.id}@example.test`
  await confirmed(owner, address)
  await event(org, 'member_joined')
  await event(org, 'bank_consent_expiring')
  const mail = collect()
  await deliverEmails(db, mail.send)
  const mine = mail.to(address)
  expect(mine).toHaveLength(2)
  // Only the optional email has a link, and the same link is in its text.
  const [optional] = mine.filter((m) => m.unsubscribe)
  expect(mine.filter((m) => m.unsubscribe)).toHaveLength(1)
  expect(optional?.subject).toContain('gått med')
  const link = optional?.unsubscribe ?? ''
  expect(optional?.text).toContain(link)
  expect(mine.find((m) => !m.unsubscribe)?.text).not.toContain('unsubscribe')

  const bad = link.replace(/sig=(.)/, (_, c) => (c === '0' ? 'sig=1' : 'sig=0'))
  expect((await unsubscribe(new Request(bad), db)).status).toBe(400)
  expect((await unsubscribe(new Request(link), db)).status).toBe(200)
  const prefs = z
    .array(z.object({ type: z.string(), email: z.boolean() }))
    .parse(
      await (await notificationsApi.preferences(req(owner, 'GET'), db)).json(),
    )
  expect(prefs.find((p) => p.type === 'member_joined')?.email).toBe(false)
  await event(org, 'member_joined')
  expect(await deliveries(org)).toHaveLength(2)
})

test('deleting the account removes the address, its confirmations and its preferences', async () => {
  const { owner, member, org } = await setup()
  await confirmed(member, 'medlem@example.test')
  await setEmail(member, 'medlem@example.test', collect().send)
  await notificationsApi.setPreference(
    req(member, 'PUT', { email: false }),
    'member_joined',
    db,
  )
  expect(await deleteUser(db, member.id)).toBe(true)
  expect(
    await db
      .selectFrom('users')
      .select('email')
      .where('id', '=', member.id)
      .execute(),
  ).toEqual([])
  for (const table of [
    'email_confirmations',
    'notification_preferences',
  ] as const)
    expect(
      await db
        .selectFrom(table)
        .selectAll()
        .where('user_id', '=', member.id)
        .execute(),
    ).toEqual([])
  expect(await inbox(owner, org)).toEqual([])
})

test('events older than 90 days are deleted, newer ones kept', async () => {
  const { org } = await setup()
  const old = await event(org)
  const fresh = await event(org)
  await db
    .updateTable('notification_events')
    .set({ created_at: sql<Date>`now() - interval '91 days'` })
    .where('id', '=', old)
    .execute()
  await deleteOldEvents(db)
  const left = await db
    .selectFrom('notification_events')
    .select('id')
    .where('organisation_id', '=', org)
    .execute()
  expect(left).toEqual([{ id: fresh }])
})

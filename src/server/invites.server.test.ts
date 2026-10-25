import { createHash } from 'node:crypto'
import { expect, test } from 'vitest'
import { z } from 'zod'
import { createdInvite, invitePreview } from '#/api/schemas'
import { invitePreview as previewApi, orgsApi } from './orgs.api.server'
import { createSession } from './session.server'
import { demoUserId, ensureDemo } from './demo.server'
import {
  addMember,
  db,
  newOrg,
  person,
  req,
  roleId,
  useDatabase,
} from './orgs.fixture'
import type { Person } from './orgs.fixture'

useDatabase()

const invite = async (admin: Person, org: string, role: string) => {
  const res = await orgsApi.createInvite(
    req(admin, 'POST', { roleId: await roleId(admin, org, role) }),
    org,
    db,
  )
  expect(res.status).toBe(201)
  return createdInvite.parse(await res.json())
}
const accept = (p: Person, token: string) =>
  orgsApi.acceptInvite(req(p, 'POST'), token, db)
const members = (org: string) =>
  db
    .selectFrom('memberships')
    .select('user_id')
    .where('organisation_id', '=', org)
    .execute()
const events = async (name: string) =>
  (
    await db
      .selectFrom('audit_events')
      .select('event')
      .where('event', '=', name)
      .execute()
  ).length

test('accepting adds exactly one membership with the invited role, and the link is then used', async () => {
  const owner = await person()
  const guest = await person()
  const org = await newOrg(owner)
  const { token } = await invite(owner, org.id, 'Medlem')
  expect((await accept(guest, token)).status).toBe(200)
  expect(await members(org.id)).toHaveLength(2)
  const other = await person()
  expect((await accept(other, token)).status).toBe(404)
  expect(await members(org.id)).toHaveLength(2)
  expect(await events('invite_created')).toBeGreaterThan(0)
  expect(await events('invite_accepted')).toBeGreaterThan(0)
})

test('two parallel accepts make one membership, and a member gets a no-op', async () => {
  const owner = await person()
  const guest = await person()
  const org = await newOrg(owner)
  const { token, id } = await invite(owner, org.id, 'Medlem')
  const results = await Promise.all([
    accept(guest, token),
    accept(guest, token),
  ])
  expect(results.map((r) => r.status)).toEqual([200, 200])
  expect(await members(org.id)).toHaveLength(2)
  // An existing member does not use up the invite.
  expect((await accept(owner, token)).status).toBe(200)
  const row = await db
    .selectFrom('invites')
    .select('used_at')
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  expect(row.used_at).not.toBeNull()
  const second = await invite(owner, org.id, 'Medlem')
  expect((await accept(owner, second.token)).status).toBe(200)
  const unused = await db
    .selectFrom('invites')
    .select('used_at')
    .where('id', '=', second.id)
    .executeTakeFirstOrThrow()
  expect(unused.used_at).toBeNull()
})

test('an invite lasts 7 days; an expired or revoked one is refused', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const { token, id } = await invite(owner, org.id, 'Medlem')
  const row = await db
    .selectFrom('invites')
    .select('expires_at')
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  const days = (row.expires_at.getTime() - Date.now()) / 86_400_000
  expect(days).toBeGreaterThan(6.99)
  expect(days).toBeLessThanOrEqual(7)

  await db
    .updateTable('invites')
    .set({ expires_at: new Date(Date.now() - 1000) })
    .where('id', '=', id)
    .execute()
  expect((await accept(await person(), token)).status).toBe(404)

  const revoked = await invite(owner, org.id, 'Medlem')
  const res = await orgsApi.revokeInvite(
    req(owner, 'DELETE'),
    org.id,
    revoked.id,
    db,
  )
  expect(res.status).toBe(204)
  expect((await accept(await person(), revoked.token)).status).toBe(404)
  expect(await events('invite_revoked')).toBeGreaterThan(0)
  expect(
    (await orgsApi.revokeInvite(req(owner, 'DELETE'), org.id, revoked.id, db))
      .status,
  ).toBe(404)
})

test('only members.manage invites, never Ägare, never a demo session', async () => {
  const owner = await person()
  const plain = await person()
  const org = await newOrg(owner)
  await addMember(owner, org.id, plain, 'Medlem')
  const medlem = await roleId(owner, org.id, 'Medlem')
  const asPlain = await orgsApi.createInvite(
    req(plain, 'POST', { roleId: medlem }),
    org.id,
    db,
  )
  expect(asPlain.status).toBe(403)
  expect((await orgsApi.invites(req(plain, 'GET'), org.id, db)).status).toBe(
    403,
  )
  const outsider = await person()
  expect(
    (
      await orgsApi.createInvite(
        req(outsider, 'POST', { roleId: medlem }),
        org.id,
        db,
      )
    ).status,
  ).toBe(404)

  const ownerRole = await roleId(owner, org.id, 'Ägare')
  const asOwner = await orgsApi.createInvite(
    req(owner, 'POST', { roleId: ownerRole }),
    org.id,
    db,
  )
  expect(asOwner.status).toBe(403)

  await ensureDemo(db)
  const demo = {
    id: demoUserId,
    token: await createSession(db, demoUserId, 'demo'),
  }
  const asDemo = await orgsApi.createInvite(
    req(demo, 'POST', { roleId: medlem }),
    org.id,
    db,
  )
  expect(asDemo.status).toBe(403)
  const { token } = await invite(owner, org.id, 'Medlem')
  const viaUrl = new Request(
    `https://api.test/api/v1/invites/${token}/accept`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${demo.token}` },
    },
  )
  expect((await orgsApi.acceptInvite(viaUrl, token, db)).status).toBe(403)
  const logged = await db.selectFrom('audit_events').select('detail').execute()
  expect(JSON.stringify(logged)).not.toContain(token)
})

test('an invite cannot name a role with permissions the inviter lacks', async () => {
  const owner = await person()
  const manager = await person()
  const org = await newOrg(owner)
  const made = await orgsApi.createRole(
    req(owner, 'POST', { name: 'Admin', permissions: ['members.manage'] }),
    org.id,
    db,
  )
  expect(made.status).toBe(201)
  await addMember(owner, org.id, manager, 'Admin')
  const strong = await orgsApi.createRole(
    req(owner, 'POST', {
      name: 'Stark',
      permissions: ['members.manage', 'roles.manage'],
    }),
    org.id,
    db,
  )
  const strongId = z.object({ id: z.string() }).parse(await strong.json()).id
  const res = await orgsApi.createInvite(
    req(manager, 'POST', { roleId: strongId }),
    org.id,
    db,
  )
  expect(res.status).toBe(403)
})

test('only the SHA-256 of the token is stored', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const { token, id } = await invite(owner, org.id, 'Medlem')
  const row = await db
    .selectFrom('invites')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  expect(row.token_hash).toEqual(createHash('sha256').update(token).digest())
  expect(JSON.stringify(row)).not.toContain(token)
  const logged = await db.selectFrom('audit_events').select('detail').execute()
  expect(JSON.stringify(logged)).not.toContain(token)
})

test('the pre-login endpoint gives the organisation name only, and one answer for every bad link', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const good = await invite(owner, org.id, 'Medlem')
  const ok = await previewApi(good.token, db)
  expect(ok.status).toBe(200)
  expect(invitePreview.parse(await ok.json())).toEqual({
    organisation: 'Bolaget AB',
  })

  const used = await invite(owner, org.id, 'Medlem')
  await accept(await person(), used.token)
  const expired = await invite(owner, org.id, 'Medlem')
  await db
    .updateTable('invites')
    .set({ expires_at: new Date(Date.now() - 1000) })
    .where('id', '=', expired.id)
    .execute()
  const revoked = await invite(owner, org.id, 'Medlem')
  await orgsApi.revokeInvite(req(owner, 'DELETE'), org.id, revoked.id, db)

  const answers = await Promise.all(
    [used.token, expired.token, revoked.token, 'x'.repeat(43), 'short'].map(
      async (t) => {
        const r = await previewApi(t, db)
        return [r.status, await r.text()]
      },
    ),
  )
  expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1)
  expect(answers[0]?.[0]).toBe(404)
})

test('the pending list shows role and expiry, never a token', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const { token } = await invite(owner, org.id, 'Medlem')
  const res = await orgsApi.invites(req(owner, 'GET'), org.id, db)
  const text = await res.text()
  expect(text).toContain('Medlem')
  expect(text).not.toContain(token)
})

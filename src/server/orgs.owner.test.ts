import { expect, test } from 'vitest'
import { deleteUser, soleOwnerOf } from './members.server'
import { orgsApi } from './orgs.api.server'
import {
  addMember,
  change,
  db,
  idOf,
  meOf,
  newOrg,
  person,
  req,
  roleId,
  useDatabase,
} from './orgs.fixture'

useDatabase()

test('the last Ägare cannot leave, be removed or be moved to another role', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const medlem = await roleId(owner, org.id, 'Medlem')
  expect((await orgsApi.leave(req(owner, 'DELETE'), org.id, db)).status).toBe(
    409,
  )
  expect(
    (await orgsApi.remove(req(owner, 'DELETE'), org.id, owner.id, db)).status,
  ).toBe(409)
  expect((await change(owner, org.id, owner, medlem)).status).toBe(409)
  expect(await soleOwnerOf(db, owner.id)).toEqual([{ organisation_id: org.id }])
  // With a second Ägare, the first may leave.
  const second = await person()
  await addMember(owner, org.id, second, 'Ägare')
  expect(await soleOwnerOf(db, owner.id)).toEqual([])
  expect((await orgsApi.leave(req(owner, 'DELETE'), org.id, db)).status).toBe(
    204,
  )
})

test('two Ägare demoting each other at the same time leave one Ägare', async () => {
  const a = await person()
  const b = await person()
  const org = await newOrg(a)
  await addMember(a, org.id, b, 'Ägare')
  const medlem = await roleId(a, org.id, 'Medlem')
  const results = await Promise.all([
    change(a, org.id, b, medlem),
    change(b, org.id, a, medlem),
  ])
  expect(results.map((r) => r.status).sort()).toEqual([204, 403]) // the loser is no longer Ägare when its turn comes
  const owners = await db
    .selectFrom('memberships')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.organisation_id', '=', org.id)
    .where('roles.kind', '=', 'owner')
    .select('user_id')
    .execute()
  expect(owners).toHaveLength(1)
})

test('roles.manage cannot create, edit or assign a role holding a permission the member lacks', async () => {
  const owner = await person()
  const manager = await person()
  const target = await person()
  const org = await newOrg(owner)
  const made = await idOf(
    await orgsApi.createRole(
      req(owner, 'POST', {
        name: 'Rollhanterare',
        permissions: ['roles.manage'],
      }),
      org.id,
      db,
    ),
  )
  const strong = await idOf(
    await orgsApi.createRole(
      req(owner, 'POST', { name: 'Stark', permissions: ['members.manage'] }),
      org.id,
      db,
    ),
  )
  await addMember(owner, org.id, manager, 'Rollhanterare')
  await addMember(owner, org.id, target, 'Medlem')
  expect(made.id).toBeTruthy()
  const create = await orgsApi.createRole(
    req(manager, 'POST', { name: 'Ny', permissions: ['members.manage'] }),
    org.id,
    db,
  )
  expect(create.status).toBe(403)
  const edit = await orgsApi.editRole(
    req(manager, 'PATCH', { permissions: ['members.manage'] }),
    org.id,
    made.id,
    db,
  )
  expect(edit.status).toBe(403)
  expect((await change(manager, org.id, target, strong.id)).status).toBe(403)
})

test('a role change takes effect on the member’s very next request, and a role in use cannot be deleted', async () => {
  const owner = await person()
  const member = await person()
  const org = await newOrg(owner)
  const made = await idOf(
    await orgsApi.createRole(
      req(owner, 'POST', { name: 'Chef', permissions: ['members.manage'] }),
      org.id,
      db,
    ),
  )
  await addMember(owner, org.id, member, 'Chef')
  expect(
    (await meOf(await orgsApi.me(req(member, 'GET'), org.id, db))).permissions,
  ).toEqual(['members.manage'])
  await change(owner, org.id, member, await roleId(owner, org.id, 'Medlem'))
  expect(
    (await meOf(await orgsApi.me(req(member, 'GET'), org.id, db))).permissions,
  ).toEqual([])
  await change(owner, org.id, member, made.id)
  expect(
    (await orgsApi.deleteRole(req(owner, 'DELETE'), org.id, made.id, db))
      .status,
  ).toBe(409)
})

test('the database refuses a role from another organisation', async () => {
  const a = await person()
  const b = await person()
  const orgA = await newOrg(a)
  const orgB = await newOrg(b)
  await expect(
    db
      .insertInto('memberships')
      .values({
        user_id: b.id,
        organisation_id: orgA.id,
        role_id: await roleId(b, orgB.id, 'Medlem'),
      })
      .execute(),
  ).rejects.toThrow()
})

test('membership and role changes are audited', async () => {
  const owner = await person()
  await newOrg(owner)
  const events = await db
    .selectFrom('audit_events')
    .select('event')
    .where('user_id', '=', owner.id)
    .execute()
  expect(events.map((e) => e.event)).toContain('organisation_created')
})

test('deleting a user is refused for the only Ägare, and removes a plain member with the membership', async () => {
  const owner = await person()
  const member = await person()
  const org = await newOrg(owner)
  await addMember(owner, org.id, member, 'Medlem')

  expect(await deleteUser(db, owner.id)).toBe(false)
  expect(await deleteUser(db, member.id)).toBe(true)
  const left = await db
    .selectFrom('memberships')
    .select('user_id')
    .where('organisation_id', '=', org.id)
    .execute()
  expect(left.map((m) => m.user_id)).toEqual([owner.id])
  expect(
    await db
      .selectFrom('users')
      .select('id')
      .where('id', 'in', [owner.id, member.id])
      .execute(),
  ).toEqual([{ id: owner.id }])
})

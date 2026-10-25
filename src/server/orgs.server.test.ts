import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { permissions } from './access.server'
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
  roles,
  useDatabase,
} from './orgs.fixture'

useDatabase()

test('the creator holds Ägare, and Medlem exists', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const rs = await roles(owner, org.id)
  expect(rs.map((r) => r.name).sort()).toEqual(['Medlem', 'Ägare'])
  const me = await meOf(await orgsApi.me(req(owner, 'GET'), org.id, db))
  expect(me.role.name).toBe('Ägare')
  expect(me.permissions).toEqual(permissions)
  const list = await orgsApi.list(req(owner, 'GET'), db)
  expect(await list.json()).toMatchObject([
    { id: org.id, role: 'Ägare', owners: 1 },
  ])
})

test('Ägare cannot be edited or deleted, and holds permissions added later', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const id = await roleId(owner, org.id, 'Ägare')
  const edit = await orgsApi.editRole(
    req(owner, 'PATCH', { permissions: [] }),
    org.id,
    id,
    db,
  )
  expect(edit.status).toBe(409)
  expect(
    (await orgsApi.deleteRole(req(owner, 'DELETE'), org.id, id, db)).status,
  ).toBe(409)
  // A permission the code list gains later is held without touching the stored role.
  expect(
    (await roles(owner, org.id)).find((r) => r.id === id)?.permissions,
  ).toEqual(permissions)
  const row = await db
    .selectFrom('roles')
    .select('permissions')
    .where('id', '=', id)
    .executeTakeFirstOrThrow()
  expect(row.permissions).toEqual([])
})

test('a custom role without members.manage cannot change members', async () => {
  const owner = await person()
  const member = await person()
  const org = await newOrg(owner)
  await addMember(owner, org.id, member, 'Medlem')
  const ownerRole = await roleId(owner, org.id, 'Ägare')
  expect((await change(member, org.id, owner, ownerRole)).status).toBe(403)
  expect(
    (await orgsApi.remove(req(member, 'DELETE'), org.id, owner.id, db)).status,
  ).toBe(403)
  const refused = await db
    .selectFrom('audit_events')
    .select('event')
    .where('user_id', '=', member.id)
    .execute()
  expect(refused.some((e) => e.event === 'authorization_refused')).toBe(true)
})

test('an unknown permission is rejected', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const r = await orgsApi.createRole(
    req(owner, 'POST', { name: 'X', permissions: ['nope'] }),
    org.id,
    db,
  )
  expect(r.status).toBe(400)
})

test('a role from another organisation cannot be used, and ids are scoped to the organisation', async () => {
  const a = await person()
  const b = await person()
  const orgA = await newOrg(a)
  const orgB = await newOrg(b)
  const foreignRole = await roleId(b, orgB.id, 'Medlem')
  await addMember(a, orgA.id, b, 'Medlem')
  expect((await change(a, orgA.id, b, foreignRole)).status).toBe(404)
  // A role id from B's organisation under A's path, on every roles route.
  expect(
    (
      await orgsApi.editRole(
        req(a, 'PATCH', { name: 'Y' }),
        orgA.id,
        foreignRole,
        db,
      )
    ).status,
  ).toBe(404)
  expect(
    (await orgsApi.deleteRole(req(a, 'DELETE'), orgA.id, foreignRole, db))
      .status,
  ).toBe(404)
  // A user who is not a member of A, on every members route.
  const stranger = await person()
  expect(
    (await orgsApi.remove(req(a, 'DELETE'), orgA.id, stranger.id, db)).status,
  ).toBe(404)
  expect(
    (await change(a, orgA.id, stranger, await roleId(a, orgA.id, 'Medlem')))
      .status,
  ).toBe(404)
})

test('a non-member gets 404 on every organisation route', async () => {
  const owner = await person()
  const outsider = await person()
  const org = await newOrg(owner)
  const id = org.id
  const rid = await roleId(owner, id, 'Medlem')
  const responses = await Promise.all([
    orgsApi.me(req(outsider, 'GET'), id, db),
    orgsApi.roles(req(outsider, 'GET'), id, db),
    orgsApi.createRole(
      req(outsider, 'POST', { name: 'Z', permissions: [] }),
      id,
      db,
    ),
    orgsApi.editRole(req(outsider, 'PATCH', { name: 'Z' }), id, rid, db),
    orgsApi.deleteRole(req(outsider, 'DELETE'), id, rid, db),
    orgsApi.members(req(outsider, 'GET'), id, db),
    change(outsider, id, owner, rid),
    orgsApi.remove(req(outsider, 'DELETE'), id, owner.id, db),
    orgsApi.leave(req(outsider, 'DELETE'), id, db),
    orgsApi.me(req(outsider, 'GET'), randomUUID(), db),
    orgsApi.me(req(outsider, 'GET'), 'not-a-uuid', db),
  ])
  expect(responses.map((r) => r.status)).toEqual(
    Array<number>(responses.length).fill(404),
  )
})

test('every route needs a session', async () => {
  expect((await orgsApi.list(req(undefined, 'GET'), db)).status).toBe(401)
  expect(
    (await orgsApi.create(req(undefined, 'POST', { name: 'A' }), db)).status,
  ).toBe(401)
  expect(
    (await orgsApi.me(req(undefined, 'GET'), randomUUID(), db)).status,
  ).toBe(401)
})

test('a role can only be edited or deleted by someone holding everything it grants now', async () => {
  const owner = await person()
  const manager = await person()
  const org = await newOrg(owner)
  const create = async (name: string, grants: string[]) =>
    idOf(
      await orgsApi.createRole(
        req(owner, 'POST', { name, permissions: grants }),
        org.id,
        db,
      ),
    )
  await create('Rollhanterare', ['roles.manage'])
  await create('Medlemshanterare', ['members.manage'])
  await addMember(owner, org.id, manager, 'Rollhanterare')
  const target = await roleId(owner, org.id, 'Medlemshanterare')

  const edit = await orgsApi.editRole(
    req(manager, 'PATCH', { permissions: [] }),
    org.id,
    target,
    db,
  )
  expect(edit.status).toBe(403)
  const remove = await orgsApi.deleteRole(
    req(manager, 'DELETE'),
    org.id,
    target,
    db,
  )
  expect(remove.status).toBe(403)
  expect(
    (await roles(owner, org.id)).find((r) => r.id === target)?.permissions,
  ).toEqual(['members.manage'])
})

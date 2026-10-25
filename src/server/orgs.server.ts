import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { DB } from './db.gen'
import type { Audit, Permission } from './access.server'
import {
  access,
  audited,
  effective,
  HttpError,
  insertOrConflict,
  lockOrg,
  mustHold,
  require,
  roleIn,
} from './access.server'

// Every organisation starts with Ägare and Medlem; the demo organisation uses the same setup.
export async function insertDefaultRoles(trx: Kysely<DB>, orgId: string) {
  const owner = await trx
    .insertInto('roles')
    .values({
      organisation_id: orgId,
      name: 'Ägare',
      kind: 'owner',
      permissions: [],
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  const member = await trx
    .insertInto('roles')
    .values({
      organisation_id: orgId,
      name: 'Medlem',
      kind: 'custom',
      permissions: [],
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  return { owner: owner.id, member: member.id }
}

export const createOrganisation = (
  db: Kysely<DB>,
  userId: string,
  name: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    const org = await trx
      .insertInto('organisations')
      .values({ name })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow()
    const roles = await insertDefaultRoles(trx, org.id)
    await trx
      .insertInto('memberships')
      .values({
        user_id: userId,
        organisation_id: org.id,
        role_id: roles.owner,
      })
      .execute()
    await audited(trx, 'organisation_created', base, org.id)
    return org
  })

export const listOrganisations = (db: Kysely<DB>, userId: string) =>
  db
    .selectFrom('memberships')
    .innerJoin(
      'organisations',
      'organisations.id',
      'memberships.organisation_id',
    )
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.user_id', '=', userId)
    .select((eb) => [
      'organisations.id',
      'organisations.name',
      'roles.name as role',
      eb
        .selectFrom('memberships as m')
        .innerJoin('roles as r', 'r.id', 'm.role_id')
        .whereRef('m.organisation_id', '=', 'organisations.id')
        .where('r.kind', '=', 'owner')
        .select(sql<number>`count(*)::int`.as('n'))
        .as('owners'),
    ])
    .orderBy('organisations.created_at')
    .execute()

export async function myAccess(db: Kysely<DB>, userId: string, orgId: string) {
  const a = await access(db, userId, orgId)
  return {
    role: { id: a.role.id, name: a.role.name, kind: a.role.kind },
    permissions: a.permissions,
  }
}

export async function listRoles(db: Kysely<DB>, userId: string, orgId: string) {
  await access(db, userId, orgId)
  const rows = await db
    .selectFrom('roles')
    .select(['id', 'name', 'kind', 'permissions'])
    .where('organisation_id', '=', orgId)
    .orderBy('name')
    .execute()
  return rows.map((r) => ({ ...r, permissions: effective(r) }))
}

export const createRole = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: { name: string; permissions: Permission[] },
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    mustHold(
      await require(trx, userId, orgId, 'roles.manage'),
      input.permissions,
    )
    const role = await insertOrConflict(() =>
      trx
        .insertInto('roles')
        .values({
          organisation_id: orgId,
          name: input.name,
          kind: 'custom',
          permissions: input.permissions,
        })
        .returning(['id', 'name', 'kind', 'permissions'])
        .executeTakeFirstOrThrow(),
    )
    await audited(trx, 'role_created', base, orgId, { role: role.id })
    return role
  })

export const editRole = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  roleId: string,
  input: { name?: string; permissions?: Permission[] },
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    const a = await require(trx, userId, orgId, 'roles.manage')
    const current = await roleIn(trx, orgId, roleId)
    if (current.kind === 'owner') throw new HttpError(409, 'owner_role_fixed')
    // Editing a role needs everything it grants now as well as everything it will grant.
    mustHold(a, effective(current))
    mustHold(a, input.permissions ?? [])
    const role = await insertOrConflict(() =>
      trx
        .updateTable('roles')
        .set({
          name: input.name ?? current.name,
          permissions: input.permissions ?? current.permissions,
        })
        .where('id', '=', roleId)
        .where('organisation_id', '=', orgId)
        .returning(['id', 'name', 'kind', 'permissions'])
        .executeTakeFirstOrThrow(),
    )
    await audited(trx, 'role_updated', base, orgId, { role: roleId })
    return role
  })

export const deleteRole = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  roleId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    const a = await require(trx, userId, orgId, 'roles.manage')
    const role = await roleIn(trx, orgId, roleId)
    if (role.kind === 'owner') throw new HttpError(409, 'owner_role_fixed')
    mustHold(a, effective(role))
    const inUse = await trx
      .selectFrom('memberships')
      .select('user_id')
      .where('role_id', '=', roleId)
      .executeTakeFirst()
    if (inUse) throw new HttpError(409, 'role_in_use')
    await trx.deleteFrom('roles').where('id', '=', roleId).execute()
    await audited(trx, 'role_deleted', base, orgId, { role: roleId })
  })

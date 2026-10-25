import type { Kysely } from 'kysely'
import type { DB } from './db.gen'
import type { Access, Audit } from './access.server'
import {
  access,
  audited,
  effective,
  insertOrConflict,
  keepsOwner,
  lockOrg,
  memberIn,
  mustHold,
  require,
  roleIn,
} from './access.server'

export async function listMembers(
  db: Kysely<DB>,
  userId: string,
  orgId: string,
) {
  await access(db, userId, orgId)
  return db
    .selectFrom('memberships')
    .innerJoin('users', 'users.id', 'memberships.user_id')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.organisation_id', '=', orgId)
    .select([
      'users.id',
      'users.name',
      'roles.id as role_id',
      'roles.name as role',
    ])
    .orderBy('memberships.created_at')
    .execute()
}

// No route yet: the invite flow (IRM-125) calls this.
export const addMember = (
  db: Kysely<DB>,
  actorId: string,
  orgId: string,
  newUserId: string,
  roleId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    const a = await require(trx, actorId, orgId, 'members.manage')
    const role = await roleIn(trx, orgId, roleId)
    mustHold(a, effective(role))
    await insertOrConflict(() =>
      trx
        .insertInto('memberships')
        .values({ user_id: newUserId, organisation_id: orgId, role_id: roleId })
        .execute(),
    )
    await audited(trx, 'member_added', base, orgId, {
      member: newUserId,
      role: roleId,
    })
  })

export const changeMemberRole = (
  db: Kysely<DB>,
  actorId: string,
  orgId: string,
  memberId: string,
  roleId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    const a = await require(trx, actorId, orgId, 'members.manage')
    const current = await memberIn(trx, orgId, memberId)
    const role = await roleIn(trx, orgId, roleId)
    mustHold(a, effective(role))
    mustHold(a, effective(current))
    if (current.kind === 'owner' && role.kind !== 'owner')
      await keepsOwner(trx, orgId, memberId)
    await trx
      .updateTable('memberships')
      .set({ role_id: roleId })
      .where('user_id', '=', memberId)
      .where('organisation_id', '=', orgId)
      .execute()
    await audited(trx, 'member_role_changed', base, orgId, {
      member: memberId,
      role: roleId,
    })
  })

async function leaveOrRemove(
  trx: Kysely<DB>,
  orgId: string,
  memberId: string,
  a: Access,
  removing: boolean,
) {
  const current = await memberIn(trx, orgId, memberId)
  if (removing) mustHold(a, effective(current))
  if (current.kind === 'owner') await keepsOwner(trx, orgId, memberId)
  await trx
    .deleteFrom('memberships')
    .where('user_id', '=', memberId)
    .where('organisation_id', '=', orgId)
    .execute()
}

export const removeMember = (
  db: Kysely<DB>,
  actorId: string,
  orgId: string,
  memberId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    const a = await require(trx, actorId, orgId, 'members.manage')
    await leaveOrRemove(trx, orgId, memberId, a, true)
    await audited(trx, 'member_removed', base, orgId, { member: memberId })
  })

export const leaveOrganisation = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await lockOrg(trx, orgId)
    await leaveOrRemove(
      trx,
      orgId,
      userId,
      await access(trx, userId, orgId),
      false,
    )
    await audited(trx, 'member_left', base, orgId)
  })

// For account deletion (IRM-92): organisations that would be left without an Ägare.
export const soleOwnerOf = (db: Kysely<DB>, userId: string) =>
  db
    .selectFrom('memberships')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.user_id', '=', userId)
    .where('roles.kind', '=', 'owner')
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('memberships as m')
            .innerJoin('roles as r', 'r.id', 'm.role_id')
            .whereRef('m.organisation_id', '=', 'memberships.organisation_id')
            .where('m.user_id', '!=', userId)
            .where('r.kind', '=', 'owner')
            .select('m.user_id'),
        ),
      ),
    )
    .select('memberships.organisation_id')
    .execute()

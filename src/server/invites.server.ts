import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { DB } from './db.gen'
import { demoUserId } from './demo.server'
import type { Audit } from './access.server'
import {
  audited,
  effective,
  HttpError,
  insertOrConflict,
  mustHold,
  require,
  roleIn,
} from './access.server'

const hash = (token: string) => createHash('sha256').update(token).digest()
export const validToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token)

// One answer for a link that is unknown, expired, revoked or used, so it says nothing about which.
const invalid = () => new HttpError(404, 'invalid_invite', false)

const pending = (trx: Kysely<DB>) =>
  trx
    .selectFrom('invites')
    .where('used_at', 'is', null)
    .where('revoked_at', 'is', null)
    .where('expires_at', '>', sql<Date>`now()`)

export const createInvite = (
  db: Kysely<DB>,
  actorId: string,
  orgId: string,
  roleId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    if (actorId === demoUserId) throw new HttpError(403, 'demo_session')
    const a = await require(trx, actorId, orgId, 'members.manage')
    const role = await roleIn(trx, orgId, roleId)
    // Ownership changes need an existing Ägare in the app, not a link.
    if (role.kind === 'owner') throw new HttpError(403, 'owner_role')
    mustHold(a, effective(role))
    const token = randomBytes(32).toString('base64url')
    const row = await trx
      .insertInto('invites')
      .values({
        organisation_id: orgId,
        role_id: roleId,
        created_by: actorId,
        token_hash: hash(token),
        expires_at: sql<Date>`now() + interval '7 days'`,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    await audited(trx, 'invite_created', base, orgId, {
      invite: row.id,
      role: roleId,
    })
    return { id: row.id, token }
  })

export async function listInvites(
  db: Kysely<DB>,
  userId: string,
  orgId: string,
) {
  await require(db, userId, orgId, 'members.manage')
  return pending(db)
    .innerJoin('roles', 'roles.id', 'invites.role_id')
    .where('invites.organisation_id', '=', orgId)
    .select(['invites.id', 'roles.name as role', 'invites.expires_at'])
    .orderBy('invites.created_at')
    .execute()
}

export const revokeInvite = (
  db: Kysely<DB>,
  actorId: string,
  orgId: string,
  inviteId: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    await require(trx, actorId, orgId, 'members.manage')
    const done = await trx
      .updateTable('invites')
      .set({ revoked_at: sql<Date>`now()` })
      .where('id', '=', inviteId)
      .where('organisation_id', '=', orgId)
      .where('used_at', 'is', null)
      .where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (!done.numUpdatedRows) throw new HttpError(404, 'not_found')
    await audited(trx, 'invite_revoked', base, orgId, { invite: inviteId })
  })

// Before login: the organisation's name and nothing else.
export async function previewInvite(db: Kysely<DB>, token: string) {
  if (!validToken(token)) throw invalid()
  const row = await pending(db)
    .innerJoin('organisations', 'organisations.id', 'invites.organisation_id')
    .where('token_hash', '=', hash(token))
    .select('organisations.name')
    .executeTakeFirst()
  if (!row) throw invalid()
  return { organisation: row.name }
}

// The invite row is locked, so two accepts of one link run one after the other. A member who is
// already in gets a no-op and the invite stays unused.
export const acceptInvite = (
  db: Kysely<DB>,
  userId: string,
  token: string,
  base: Audit,
) =>
  db.transaction().execute(async (trx) => {
    if (userId === demoUserId) throw new HttpError(403, 'demo_session')
    if (!validToken(token)) throw invalid()
    const invite = await trx
      .selectFrom('invites')
      .select([
        'id',
        'organisation_id',
        'role_id',
        sql<boolean>`used_at is null and revoked_at is null and expires_at > now()`.as(
          'usable',
        ),
      ])
      .where('token_hash', '=', hash(token))
      .forUpdate()
      .executeTakeFirst()
    if (!invite) throw invalid()
    const member = await trx
      .selectFrom('memberships')
      .select('user_id')
      .where('user_id', '=', userId)
      .where('organisation_id', '=', invite.organisation_id)
      .executeTakeFirst()
    if (member) return { organisationId: invite.organisation_id }
    if (!invite.usable) throw invalid()
    await trx
      .updateTable('invites')
      .set({ used_at: sql<Date>`now()` })
      .where('id', '=', invite.id)
      .execute()
    await insertOrConflict(() =>
      trx
        .insertInto('memberships')
        .values({
          user_id: userId,
          organisation_id: invite.organisation_id,
          role_id: invite.role_id,
        })
        .execute(),
    )
    await audited(trx, 'invite_accepted', base, invite.organisation_id, {
      invite: invite.id,
      role: invite.role_id,
    })
    return { organisationId: invite.organisation_id }
  })

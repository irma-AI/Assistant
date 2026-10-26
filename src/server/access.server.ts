import type { Kysely } from 'kysely'
import { recordAudit } from './audit.server'
import type { AuditEvent } from './audit.server'
import type { DB } from './db.gen'

// The one list of permissions. Code checks these, never role names.
export const permissions = [
  'organisation.manage',
  'members.manage',
  'roles.manage',
  'customers.manage',
  'documents.manage',
] as const
export type Permission = (typeof permissions)[number]
const isPermission = (p: string): p is Permission =>
  permissions.some((x) => x === p)

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // A refused authorisation is audited by the caller, outside the rolled-back transaction.
    readonly refused = status === 403,
  ) {
    super(message)
  }
}

type RoleRow = { id: string; name: string; kind: string; permissions: string[] }

// Ägare always holds every permission, including ones added to the code later; a stored permission
// that is no longer in the list is ignored.
export const effective = (r: Pick<RoleRow, 'kind' | 'permissions'>) =>
  r.kind === 'owner' ? [...permissions] : r.permissions.filter(isPermission)

export const roleColumns = [
  'roles.id',
  'roles.name',
  'roles.kind',
  'roles.permissions',
] as const

// No cache: read on every request so a role change takes effect at once.
export async function access(db: Kysely<DB>, userId: string, orgId: string) {
  const role = await db
    .selectFrom('memberships')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.user_id', '=', userId)
    .where('memberships.organisation_id', '=', orgId)
    .select(roleColumns)
    .executeTakeFirst()
  if (!role) throw new HttpError(404, 'not_found', true) // a non-member learns nothing about the organisation
  return { role, permissions: effective(role) }
}

export type Access = Awaited<ReturnType<typeof access>>

export async function require(
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  permission: Permission,
) {
  const a = await access(db, userId, orgId)
  if (!a.permissions.includes(permission)) throw new HttpError(403, 'forbidden')
  return a
}

// No escalation: a role can only be made or given by someone who holds everything in it.
export function mustHold(a: Access, wanted: string[]) {
  if (!wanted.every((p) => a.permissions.some((x) => x === p)))
    throw new HttpError(403, 'escalation')
}

// Serialises everything that can change who is Ägare; row locks on memberships alone would not.
export async function lockOrg(trx: Kysely<DB>, orgId: string) {
  const org = await trx
    .selectFrom('organisations')
    .select('id')
    .where('id', '=', orgId)
    .forUpdate()
    .executeTakeFirst()
  if (!org) throw new HttpError(404, 'not_found', true)
}

export async function roleIn(db: Kysely<DB>, orgId: string, roleId: string) {
  const role = await db
    .selectFrom('roles')
    .select(['id', 'name', 'kind', 'permissions'])
    .where('id', '=', roleId)
    .where('organisation_id', '=', orgId)
    .executeTakeFirst()
  if (!role) throw new HttpError(404, 'not_found')
  return role
}

export async function memberIn(db: Kysely<DB>, orgId: string, userId: string) {
  const row = await db
    .selectFrom('memberships')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.user_id', '=', userId)
    .where('memberships.organisation_id', '=', orgId)
    .select(roleColumns)
    .executeTakeFirst()
  if (!row) throw new HttpError(404, 'not_found')
  return row
}

// Call after lockOrg: the organisation must keep an Ägare besides `leaving`.
export async function keepsOwner(
  trx: Kysely<DB>,
  orgId: string,
  leaving: string,
) {
  const left = await trx
    .selectFrom('memberships')
    .innerJoin('roles', 'roles.id', 'memberships.role_id')
    .where('memberships.organisation_id', '=', orgId)
    .where('memberships.user_id', '!=', leaving)
    .where('roles.kind', '=', 'owner')
    .select('memberships.user_id')
    .executeTakeFirst()
  if (!left) throw new HttpError(409, 'last_owner')
}

const unique = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e && e.code === '23505'

export async function insertOrConflict<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (e) {
    if (unique(e)) throw new HttpError(409, 'conflict')
    throw e
  }
}

export type Audit = Omit<AuditEvent, 'event'>
export const audited = (
  trx: Kysely<DB>,
  event: AuditEvent['event'],
  base: Audit,
  orgId: string,
  detail: Record<string, string> = {},
) =>
  recordAudit(trx, {
    ...base,
    event,
    detail: { organisation: orgId, ...detail },
  })

// The one check for anything with an effect outside the system (filing with Skatteverket, payments, email,
// invites, BankID signing, new organisations): a demo session never gets through.
export function refuseDemo(kind: string) {
  if (kind === 'demo') throw new HttpError(403, 'demo_session')
}

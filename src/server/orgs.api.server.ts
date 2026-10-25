import type { Kysely } from 'kysely'
import { z } from 'zod'
import type { Audit } from './access.server'
import { HttpError } from './access.server'
import { newOrganisation, newRole, roleChange, roleEdit } from '#/api/schemas'
import { clientIp, recordAudit } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import * as members from './members.server'
import * as orgs from './orgs.server'
import { authenticate } from './session.server'

type Ctx = {
  db: Kysely<DB>
  userId: string
  base: Audit
}

const json = (body: unknown, status = 200) => Response.json(body, { status })
const done = async (action: Promise<void>) => {
  await action
  return new Response(null, { status: 204 })
}

// Every handler goes through here: session first, ids must be UUIDs (anything else is a 404),
// and a refused authorisation is audited once the transaction has rolled back.
async function handle(
  request: Request,
  ids: string[],
  run: (c: Ctx) => Promise<Response>,
  db: Kysely<DB> = getDb(),
) {
  const userId = await authenticate(db, request)
  if (!userId) return json({ error: 'unauthorized' }, 401)
  const base = { userId, ip: clientIp(request) }
  try {
    if (!ids.every((id) => z.uuid().safeParse(id).success))
      throw new HttpError(404, 'not_found', false)
    return await run({ db, userId, base })
  } catch (e) {
    if (!(e instanceof HttpError)) throw e
    if (e.refused)
      await recordAudit(db, {
        ...base,
        event: 'authorization_refused',
        detail: { path: new URL(request.url).pathname, method: request.method },
      })
    return json({ error: e.message }, e.status)
  }
}

async function parse<T extends z.ZodType>(request: Request, schema: T) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) throw new HttpError(400, 'bad_request', false)
  return parsed.data
}

export const orgsApi = {
  list: (request: Request, db?: Kysely<DB>) =>
    handle(
      request,
      [],
      async (c) => json(await orgs.listOrganisations(c.db, c.userId)),
      db,
    ),
  create: (request: Request, db?: Kysely<DB>) =>
    handle(
      request,
      [],
      async (c) => {
        const { name } = await parse(request, newOrganisation)
        return json(
          await orgs.createOrganisation(c.db, c.userId, name, c.base),
          201,
        )
      },
      db,
    ),
  me: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await orgs.myAccess(c.db, c.userId, orgId)),
      db,
    ),
  roles: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await orgs.listRoles(c.db, c.userId, orgId)),
      db,
    ),
  createRole: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        const input = await parse(request, newRole)
        return json(
          await orgs.createRole(c.db, c.userId, orgId, input, c.base),
          201,
        )
      },
      db,
    ),
  editRole: (
    request: Request,
    orgId: string,
    roleId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, roleId],
      async (c) => {
        const input = await parse(request, roleEdit)
        return json(
          await orgs.editRole(c.db, c.userId, orgId, roleId, input, c.base),
        )
      },
      db,
    ),
  deleteRole: (
    request: Request,
    orgId: string,
    roleId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, roleId],
      async (c) => done(orgs.deleteRole(c.db, c.userId, orgId, roleId, c.base)),
      db,
    ),
  members: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await members.listMembers(c.db, c.userId, orgId)),
      db,
    ),
  changeRole: (
    request: Request,
    orgId: string,
    memberId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, memberId],
      async (c) => {
        const { roleId } = await parse(request, roleChange)
        return done(
          members.changeMemberRole(
            c.db,
            c.userId,
            orgId,
            memberId,
            roleId,
            c.base,
          ),
        )
      },
      db,
    ),
  remove: (
    request: Request,
    orgId: string,
    memberId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, memberId],
      async (c) =>
        done(members.removeMember(c.db, c.userId, orgId, memberId, c.base)),
      db,
    ),
  leave: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        done(members.leaveOrganisation(c.db, c.userId, orgId, c.base)),
      db,
    ),
}

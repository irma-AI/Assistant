import type { Kysely } from 'kysely'
import { customerImport, newCustomer } from '#/api/schemas'
import { handle, json, parse } from './orgs.api.server'
import * as customers from './customers.server'
import type { DB } from './db.gen'

const noContent = () => new Response(null, { status: 204 })

export const customersApi = {
  list: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await customers.listCustomers(c.db, c.userId, orgId)),
      db,
    ),
  create: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        const input = await parse(request, newCustomer)
        return json(
          await customers.createCustomer(c.db, c.userId, orgId, input, c.base),
          201,
        )
      },
      db,
    ),
  update: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        const input = await parse(request, newCustomer)
        await customers.updateCustomer(c.db, c.userId, orgId, id, input, c.base)
        return noContent()
      },
      db,
    ),
  remove: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        await customers.deleteCustomer(c.db, c.userId, orgId, id, c.base)
        return noContent()
      },
      db,
    ),
  import: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        const input = await parse(request, customerImport)
        return json(
          await customers.importCustomers(c.db, c.userId, orgId, input, c.base),
        )
      },
      db,
    ),
}

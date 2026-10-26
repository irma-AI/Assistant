import type { Kysely } from 'kysely'
import { receiptVerdict } from '#/api/schemas'
import type { DB } from './db.gen'
import { handle, json, parse } from './orgs.api.server'
import * as payments from './payments.server'

export const paymentsApi = {
  list: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await payments.listPayments(c.db, c.userId, orgId)),
      db,
    ),
  decide: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        const { verdict } = await parse(request, receiptVerdict)
        await payments.decidePayment(c.db, c.userId, orgId, id, verdict, c.base)
        return new Response(null, { status: 204 })
      },
      db,
    ),
}

import type { Kysely } from 'kysely'
import {
  receiptFields,
  receiptLink,
  receiptSettings,
  receiptVerdict,
} from '#/api/schemas'
import { HttpError } from './access.server'
import type { DB } from './db.gen'
import { maxBytes } from './documents.server'
import { readCapped } from './documents.api.server'
import { handle, json, parse } from './orgs.api.server'
import * as receipts from './receipts.server'
import * as decide from './receipts.decide.server'
import * as settings from './receipts.settings.server'

const noContent = () => new Response(null, { status: 204 })

export const receiptsApi = {
  list: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await receipts.listReceipts(c.db, c.userId, orgId)),
      db,
    ),
  // The body is the file itself; `?name=` is its name and `?source=photo` marks a photo from the app.
  upload: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        if (Number(request.headers.get('content-length')) > maxBytes)
          throw new HttpError(413, 'too_large', false)
        const q = new URL(request.url).searchParams
        const bytes = await readCapped(request, maxBytes)
        return json(
          await receipts.uploadReceipt(
            c.db,
            c.userId,
            orgId,
            q.get('name') ?? '',
            bytes,
            q.get('source') === 'photo' ? 'photo' : 'upload',
            c.base,
          ),
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
        await receipts.updateReceipt(
          c.db,
          c.userId,
          orgId,
          id,
          await parse(request, receiptFields),
          c.base,
        )
        return noContent()
      },
      db,
    ),
  link: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        const b = await parse(request, receiptLink)
        return json(
          await decide.link(
            c.db,
            c.userId,
            orgId,
            id,
            b.transactionId,
            b.coversOre,
            c.base,
          ),
          201,
        )
      },
      db,
    ),
  decide: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        const { verdict } = await parse(request, receiptVerdict)
        await decide.decide(c.db, c.userId, orgId, id, verdict, c.base)
        return noContent()
      },
      db,
    ),
  unmatched: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(await receipts.unmatchedTransactions(c.db, c.userId, orgId)),
      db,
    ),
  settings: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await settings.getSettings(c.db, c.userId, orgId)),
      db,
    ),
  setSettings: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        const { suggestions } = await parse(request, receiptSettings)
        await decide.setSuggestions(c.db, c.userId, orgId, suggestions, c.base)
        return noContent()
      },
      db,
    ),
}

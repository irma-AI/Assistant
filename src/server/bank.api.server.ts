import type { Kysely } from 'kysely'
import { newBankAccount } from '#/api/schemas'
import { HttpError } from './access.server'
import * as bank from './bank.server'
import type { DB } from './db.gen'
import { readCapped } from './documents.api.server'
import { handle, json, parse } from './orgs.api.server'

export const bankApi = {
  accounts: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await bank.listAccounts(c.db, c.userId, orgId)),
      db,
    ),
  createAccount: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        const { title } = await parse(request, newBankAccount)
        return json(
          await bank.createAccount(c.db, c.userId, orgId, title, c.base),
          201,
        )
      },
      db,
    ),
  transactions: (
    request: Request,
    orgId: string,
    accountId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, accountId],
      async (c) =>
        json(
          await bank.listTransactions(
            c.db,
            c.userId,
            orgId,
            accountId,
            new URL(request.url).searchParams.get('cursor') ?? undefined,
          ),
        ),
      db,
    ),
  imports: (
    request: Request,
    orgId: string,
    accountId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, accountId],
      async (c) =>
        json(await bank.listImports(c.db, c.userId, orgId, accountId)),
      db,
    ),
  // The body is the statement file itself; its name comes in `?name=`.
  import: (
    request: Request,
    orgId: string,
    accountId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, accountId],
      async (c) => {
        if (Number(request.headers.get('content-length')) > bank.maxBytes)
          throw new HttpError(413, 'too_large', false)
        const name = new URL(request.url).searchParams.get('name') ?? ''
        const bytes = await readCapped(request, bank.maxBytes)
        return json(
          await bank.importStatement(
            c.db,
            c.userId,
            orgId,
            accountId,
            name,
            bytes,
            c.base,
          ),
          201,
        )
      },
      db,
    ),
}

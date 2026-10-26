import type { Kysely } from 'kysely'
import {
  accountEdit,
  attachInput,
  lockInput,
  newAccount,
  newFiscalYear,
  reverseInput,
  voucherInput,
} from '#/api/bookkeeping'
import { HttpError } from './access.server'
import * as chart from './bookkeeping.server'
import * as posting from './posting.server'
import * as vouchers from './vouchers.server'
import type { DB } from './db.gen'
import { handle, json, parse } from './orgs.api.server'

const accountNumber = (n: string) => {
  if (!/^[1-8]\d{3}$/.test(n)) throw new HttpError(404, 'not_found', false)
  return n
}

export const bookkeepingApi = {
  years: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await chart.listFiscalYears(c.db, c.userId, orgId)),
      db,
    ),
  createYear: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(
          await chart.createFiscalYear(
            c.db,
            c.userId,
            orgId,
            await parse(request, newFiscalYear),
          ),
          201,
        ),
      db,
    ),
  lockYear: (
    request: Request,
    orgId: string,
    yearId: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, yearId],
      async (c) =>
        json(
          await chart.lockFiscalYear(
            c.db,
            c.userId,
            orgId,
            yearId,
            (await parse(request, lockInput)).locked_through,
          ),
        ),
      db,
    ),
  accounts: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await chart.listAccounts(c.db, c.userId, orgId)),
      db,
    ),
  addAccount: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(
          await chart.addAccount(
            c.db,
            c.userId,
            orgId,
            await parse(request, newAccount),
          ),
          201,
        ),
      db,
    ),
  editAccount: (
    request: Request,
    orgId: string,
    number: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(
          await chart.editAccount(
            c.db,
            c.userId,
            orgId,
            accountNumber(number),
            await parse(request, accountEdit),
          ),
        ),
      db,
    ),
  vouchers: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(
          await vouchers.listVouchers(
            c.db,
            c.userId,
            orgId,
            new URL(request.url).searchParams.get('fiscal_year_id') ??
              undefined,
          ),
        ),
      db,
    ),
  createVoucher: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(
          await vouchers.createVoucher(
            c.db,
            c.userId,
            orgId,
            await parse(request, voucherInput),
          ),
          201,
        ),
      db,
    ),
  voucher: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => json(await vouchers.getVoucher(c.db, c.userId, orgId, id)),
      db,
    ),
  replaceDraft: (
    request: Request,
    orgId: string,
    id: string,
    db?: Kysely<DB>,
  ) =>
    handle(
      request,
      [orgId, id],
      async (c) =>
        json(
          await vouchers.replaceDraft(
            c.db,
            c.userId,
            orgId,
            id,
            await parse(request, voucherInput),
          ),
        ),
      db,
    ),
  deleteDraft: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        await vouchers.deleteDraft(c.db, c.userId, orgId, id)
        return new Response(null, { status: 204 })
      },
      db,
    ),
  post: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => json(await posting.postVoucher(c.db, c.userId, orgId, id)),
      db,
    ),
  reverse: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) =>
        json(
          await posting.reverseVoucher(
            c.db,
            c.userId,
            orgId,
            id,
            (await parse(request, reverseInput)).voucher_date,
          ),
          201,
        ),
      db,
    ),
  attach: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) =>
        json(
          await vouchers.attachDocument(
            c.db,
            c.userId,
            orgId,
            id,
            (await parse(request, attachInput)).document_id,
          ),
          201,
        ),
      db,
    ),
}

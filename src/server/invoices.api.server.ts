import type { Kysely } from 'kysely'
import { invoiceInput, sendInput } from '#/api/invoices'
import type { DB } from './db.gen'
import { sendMail } from './email.server'
import type { Send } from './email.server'
import * as invoices from './invoices.server'
import { getInvoice, listInvoices } from './invoices.read.server'
import { emailInvoice } from './invoices.email.server'
import { sendInvoice } from './invoices.send.server'
import { handle, json, parse } from './orgs.api.server'

// The PDF is a document: it downloads from /documents/:id, whose id is on the invoice.
export const invoicesApi = {
  list: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await listInvoices(c.db, c.userId, orgId)),
      db,
    ),
  create: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) =>
        json(
          await invoices.createInvoice(
            c.db,
            c.userId,
            orgId,
            await parse(request, invoiceInput),
          ),
          201,
        ),
      db,
    ),
  get: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => json(await getInvoice(c.db, c.userId, orgId, id)),
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
          await invoices.replaceDraft(
            c.db,
            c.userId,
            orgId,
            id,
            await parse(request, invoiceInput),
          ),
        ),
      db,
    ),
  deleteDraft: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        await invoices.deleteDraft(c.db, c.userId, orgId, id)
        return new Response(null, { status: 204 })
      },
      db,
    ),
  credit: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) =>
        json(await invoices.createCredit(c.db, c.userId, orgId, id), 201),
      db,
    ),
  send: (
    request: Request,
    orgId: string,
    id: string,
    db?: Kysely<DB>,
    mail: Send = sendMail,
  ) =>
    handle(
      request,
      [orgId, id],
      async (c) =>
        json(
          await sendInvoice(
            c.db,
            c.userId,
            orgId,
            id,
            (await parse(request, sendInput)).delivery,
            mail,
          ),
        ),
      db,
    ),
  email: (
    request: Request,
    orgId: string,
    id: string,
    db?: Kysely<DB>,
    mail: Send = sendMail,
  ) =>
    handle(
      request,
      [orgId, id],
      async (c) => json(await emailInvoice(c.db, c.userId, orgId, id, mail)),
      db,
    ),
}

import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { vatNumber } from '#/api/company'
import { HttpError } from './access.server'
import { history, mapped } from './bookkeeping.shared.server'
import type { Actor, Trx } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import { sendMail } from './email.server'
import type { Send } from './email.server'
import { book } from './invoices.book.server'
import { emailInvoice } from './invoices.email.server'
import { draft } from './invoices.server'
import { invoicePdf } from './invoicePdf.server'
import {
  buyerJson,
  manage,
  readInvoice,
  sellerJson,
  sent,
} from './invoices.read.server'
import type { Sent, View } from './invoices.read.server'
import { storage } from './storage.server'
import { inOrganisation } from './tenant.server'

async function parties(trx: Trx, orgId: string, v: View) {
  if (v.credits_id) {
    const o = await trx
      .selectFrom('invoices')
      .select(['buyer', 'seller'])
      .where('organisation_id', '=', orgId)
      .where('id', '=', v.credits_id)
      .executeTakeFirstOrThrow()
    return {
      buyer: buyerJson.parse(o.buyer),
      seller: sellerJson.parse(o.seller),
    }
  }
  const c = v.customer_id
    ? await trx
        .selectFrom('customers')
        .select([
          'kind',
          'name',
          'address',
          'email',
          'language',
          'org_number',
          'vat_number',
        ])
        .where('organisation_id', '=', orgId)
        .where('id', '=', v.customer_id)
        .executeTakeFirst()
    : undefined
  if (!c) throw new HttpError(422, 'customer_missing')
  const co = await trx
    .selectFrom('company_details')
    .selectAll()
    .where('organisation_id', '=', orgId)
    .executeTakeFirst()
  if (!co) throw new HttpError(422, 'company_details_missing')
  if (v.lines.some((l) => l.vat_code === 'rc') && !c.vat_number)
    throw new HttpError(422, 'buyer_vat_number_required')
  return {
    buyer: buyerJson.parse(c),
    seller: sellerJson.parse({ ...co, vat_number: vatNumber(co.org_number) }),
  }
}

// The PDF becomes a retained document and, under the invoice method, the booking.
async function archive(
  trx: Trx,
  orgId: string,
  who: Actor,
  v: Sent,
  method: 'invoice' | 'cash',
) {
  const bytes = invoicePdf(v)
  const documentId = randomUUID()
  const key = `${orgId}/${documentId}`
  await trx
    .insertInto('documents')
    .values({
      id: documentId,
      organisation_id: orgId,
      name: `${v.kind === 'credit_note' ? 'Kreditfaktura' : 'Faktura'} ${String(v.number)}.pdf`,
      content_type: 'application/pdf',
      size_bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      storage_key: key,
    })
    .execute()
  let voucherId: string | null = null
  if (method === 'invoice') {
    voucherId = await book(trx, orgId, who, v, documentId)
  } else {
    // Booked at payment (IRM-166), but the PDF is a retained document from now on.
    await sql`update documents set retain_until = (select retain_until from fiscal_years
      where organisation_id = ${orgId}::uuid and ${v.invoice_date}::date between starts_on and ends_on)
      where id = ${documentId}::uuid`.execute(trx)
  }
  await trx
    .updateTable('invoices')
    .set({ document_id: documentId, voucher_id: voucherId })
    .where('organisation_id', '=', orgId)
    .where('id', '=', v.id)
    .execute()
  await history(
    trx,
    orgId,
    who,
    v.kind === 'credit_note' ? 'credit_note_sent' : 'invoice_sent',
    { number: v.number },
    voucherId ?? undefined,
  )
  // Last, inside the transaction: if the file can't be written, everything rolls back with it.
  await storage.put(key, bytes)
}

export const sendInvoice = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  delivery: 'email' | 'download',
  send: Send = sendMail,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      await draft(trx, orgId, id)
      const before = await readInvoice(trx, orgId, id)
      const { buyer, seller } = await parties(trx, orgId, before)
      if (delivery === 'email' && !buyer.email)
        throw new HttpError(422, 'buyer_email_required')
      // One UPDATE: the database numbers it, sets the OCR reference and the totals, and freezes it.
      await trx
        .updateTable('invoices')
        .set({
          status: 'sent',
          buyer: JSON.stringify(buyer),
          seller: JSON.stringify(seller),
          sent_by: who.id,
          sent_by_name: who.name,
        })
        .where('organisation_id', '=', orgId)
        .where('id', '=', id)
        .execute()
      await archive(
        trx,
        orgId,
        who,
        sent(await readInvoice(trx, orgId, id)),
        seller.accounting_method,
      )
      return readInvoice(trx, orgId, id)
    }),
  ).then(async (v) => {
    if (delivery !== 'email') return { invoice: v, email: 'not_requested' }
    try {
      return {
        invoice: await emailInvoice(db, userId, orgId, id, send),
        email: 'sent',
      }
    } catch (e) {
      // The invoice is sent for good; only the mail failed, and it can be sent again.
      if (e instanceof HttpError) return { invoice: v, email: 'failed' }
      throw e
    }
  })

import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { HttpError } from './access.server'
import type { DB } from './db.gen'
import { sendMail } from './email.server'
import type { Send } from './email.server'
import { money } from './invoicePdf.server'
import { manage, readInvoice, sent } from './invoices.read.server'
import { storage } from './storage.server'
import { inOrganisation } from './tenant.server'

// Mails the stored PDF to the buyer and records when and to whom. Sent outside any transaction: a mail can't be
// rolled back, so the invoice is never left unsent because of it.
export async function emailInvoice(
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  send: Send = sendMail,
) {
  const v = await inOrganisation(db, orgId, async (trx) => {
    await manage(trx, userId, orgId)
    const s = sent(await readInvoice(trx, orgId, id))
    if (!s.buyer.email) throw new HttpError(422, 'buyer_email_required')
    if (!s.document_id) throw new HttpError(409, 'not_sent')
    const doc = await trx
      .selectFrom('documents')
      .select(['name', 'storage_key'])
      .where('organisation_id', '=', orgId)
      .where('id', '=', s.document_id)
      .executeTakeFirstOrThrow()
    return { ...s, name: doc.name, bytes: await storage.get(doc.storage_key) }
  })
  const to = v.buyer.email ?? ''
  const en = v.buyer.language === 'en'
  const what =
    v.kind === 'credit_note'
      ? en
        ? 'Credit note'
        : 'Kreditfaktura'
      : en
        ? 'Invoice'
        : 'Faktura'
  const pay = `${v.seller.payment_kind} ${v.seller.payment_number}, ${en ? 'payment reference' : 'OCR'} ${v.ocr}`
  try {
    await send({
      to,
      subject: `${what} ${String(v.number)} ${en ? 'from' : 'från'} ${v.seller.legal_name}`,
      text: en
        ? `${what} ${String(v.number)} is attached.\n\nAmount: ${money(v.totals.total, 'en')} SEK\nDue: ${v.due_date}\nPay to ${pay}\n\n${v.seller.legal_name}`
        : `${what} ${String(v.number)} ligger som bilaga.\n\nBelopp: ${money(v.totals.total, 'sv')} kr\nFörfallodatum: ${v.due_date}\nBetala till ${pay}\n\n${v.seller.legal_name}`,
      attachments: [
        { filename: v.name, content: v.bytes, contentType: 'application/pdf' },
      ],
    })
  } catch {
    throw new HttpError(502, 'invoice_email_failed', false)
  }
  return inOrganisation(db, orgId, async (trx) => {
    await trx
      .updateTable('invoices')
      .set({ emailed_to: to, emailed_at: sql<Date>`now()` })
      .where('organisation_id', '=', orgId)
      .where('id', '=', id)
      .execute()
    return readInvoice(trx, orgId, id)
  })
}

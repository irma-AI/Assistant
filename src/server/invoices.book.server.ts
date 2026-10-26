import type { Actor, Trx } from './bookkeeping.shared.server'
import type { Sent } from './invoices.read.server'
import { post } from './posting.server'
import { writeLines, yearFor } from './vouchers.server'

export const sales = {
  '25': '3001',
  '12': '3002',
  '6': '3003',
  '0': '3004',
  rc: '3231',
}
export const outputVat = { '25': '2611', '12': '2621', '6': '2631' }
const isCode = <T extends object>(m: T, k: string): k is keyof T & string =>
  k in m

// Receivable, revenue and output VAT. A credit note is the same voucher with the sides swapped.
export async function book(
  trx: Trx,
  orgId: string,
  who: Actor,
  v: Sent,
  documentId: string,
) {
  const amounts = new Map<string, number>()
  const add = (account: string, n: number) =>
    amounts.set(account, (amounts.get(account) ?? 0) + n)
  for (const r of v.rates) {
    if (isCode(sales, r.vat_code) && r.net > 0) add(sales[r.vat_code], r.net)
    if (isCode(outputVat, r.vat_code) && r.vat > 0)
      add(outputVat[r.vat_code], r.vat)
  }
  const credit = v.kind === 'credit_note'
  const side = (n: number, receivable: boolean) =>
    receivable === credit ? { debit: 0, credit: n } : { debit: n, credit: 0 }
  const lines = [
    { account: '1510', ...side(v.totals.total, true) },
    ...[...amounts].map(([account, n]) => ({ account, ...side(n, false) })),
  ]
  const voucher = await trx
    .insertInto('vouchers')
    .values({
      organisation_id: orgId,
      fiscal_year_id: await yearFor(trx, orgId, v.invoice_date),
      voucher_date: v.invoice_date,
      description:
        `${credit ? 'Kreditfaktura' : 'Faktura'} ${String(v.number)} ${v.buyer.name}`.slice(
          0,
          500,
        ),
      created_by: who.id,
      created_by_name: who.name,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await writeLines(trx, orgId, voucher.id, lines)
  await trx
    .insertInto('voucher_documents')
    .values({
      organisation_id: orgId,
      voucher_id: voucher.id,
      document_id: documentId,
    })
    .execute()
  // Posting freezes the voucher and sets the PDF's retention date.
  await post(trx, orgId, voucher.id, who)
  return voucher.id
}

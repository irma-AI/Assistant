import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { DB } from './db.gen'

type Account = { number: string; name: string }

// What the organisation booked for each supplier before: the expense account and the input VAT account (264x) most
// often used in posted vouchers whose underlag is a receipt from that supplier. Nothing is booked from this.
export async function bookedBefore(trx: Kysely<DB>, orgId: string) {
  const rows = await trx
    .selectFrom('voucher_lines as l')
    .innerJoin('vouchers as v', 'v.id', 'l.voucher_id')
    .innerJoin('voucher_documents as vd', 'vd.voucher_id', 'v.id')
    .innerJoin('receipts as r', (j) =>
      j
        .onRef('r.document_id', '=', 'vd.document_id')
        .onRef('r.organisation_id', '=', 'vd.organisation_id'),
    )
    .innerJoin('accounts as a', (j) =>
      j
        .onRef('a.number', '=', 'l.account')
        .onRef('a.organisation_id', '=', 'l.organisation_id'),
    )
    .select([
      sql<string>`lower(trim(r.supplier))`.as('supplier'),
      'a.number',
      'a.name',
      sql<string>`count(*)`.as('n'),
    ])
    .where('v.organisation_id', '=', orgId)
    .where('v.status', '=', 'posted')
    .where('l.debit', '>', '0')
    .where('r.supplier', 'is not', null)
    .where(sql<boolean>`l.account >= '4' or l.account like '264%'`)
    .groupBy([sql`lower(trim(r.supplier))`, 'a.number', 'a.name'])
    .orderBy('n', 'desc')
    .execute()
  const out = new Map<
    string,
    { suggested_account: Account | null; suggested_vat_account: Account | null }
  >()
  for (const r of rows) {
    const e = out.get(r.supplier) ?? {
      suggested_account: null,
      suggested_vat_account: null,
    }
    const key = r.number.startsWith('264')
      ? 'suggested_vat_account'
      : 'suggested_account'
    // Rows come most used first.
    e[key] ??= { number: r.number, name: r.name }
    out.set(r.supplier, e)
  }
  return out
}

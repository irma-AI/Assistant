import type { Actor, Trx } from './bookkeeping.shared.server'
import { outputVat, sales } from './invoices.book.server'
import type { Sent } from './invoices.read.server'
import { post } from './posting.server'
import { writeLines, yearFor } from './vouchers.server'

// Splits `paid` over the amounts in proportion, rounding the running sums (half up) so the parts add up to `paid`
// exactly. BigInt, because an amount times a payment can pass 2^53.
export function allocate(amounts: number[], paid: number) {
  const total = BigInt(amounts.reduce((s, a) => s + a, 0))
  let before = 0n
  let sum = 0n
  return amounts.map((a) => {
    sum += BigInt(a)
    const upTo = (2n * sum * BigInt(paid) + total) / (2n * total)
    const part = Number(upTo - before)
    before = upTo
    return part
  })
}

const isCode = <T extends object>(m: T, k: string): k is keyof T & string =>
  k in m

// The settlement of one confirmed payment, dated by the payment. Under the invoice method the revenue is already
// booked, so the bank is set against the receivable. Under the cash method revenue and VAT are booked now, in the
// invoice's proportions (IRM-166).
// shortcut: the split is rounded per payment, so many part payments can leave a few öre off the invoice's own VAT, add a final true-up when a customer reports it.
export async function settle(
  trx: Trx,
  orgId: string,
  who: Actor,
  v: Sent,
  date: string,
  paid: number,
) {
  const credits: [string, number][] = []
  if (v.seller.accounting_method === 'invoice') credits.push(['1510', paid])
  else {
    const parts = new Map<string, number>()
    for (const r of v.rates) {
      if (isCode(sales, r.vat_code))
        parts.set(
          sales[r.vat_code],
          (parts.get(sales[r.vat_code]) ?? 0) + r.net,
        )
      if (isCode(outputVat, r.vat_code) && r.vat > 0)
        parts.set(
          outputVat[r.vat_code],
          (parts.get(outputVat[r.vat_code]) ?? 0) + r.vat,
        )
    }
    const accounts = [...parts.keys()]
    const split = allocate([...parts.values()], paid)
    accounts.forEach((a, i) => credits.push([a, split[i] ?? 0]))
  }
  const voucher = await trx
    .insertInto('vouchers')
    .values({
      organisation_id: orgId,
      fiscal_year_id: await yearFor(trx, orgId, date),
      voucher_date: date,
      description:
        `Betalning faktura ${String(v.number)} ${v.buyer.name}`.slice(0, 500),
      created_by: who.id,
      created_by_name: who.name,
    })
    .returning('id')
    .executeTakeFirstOrThrow()
  await writeLines(trx, orgId, voucher.id, [
    { account: '1930', debit: paid, credit: 0 },
    ...credits
      .filter(([, n]) => n > 0)
      .map(([account, n]) => ({ account, debit: 0, credit: n })),
  ])
  // Posting freezes the voucher.
  await post(trx, orgId, voucher.id, who)
  return voucher.id
}

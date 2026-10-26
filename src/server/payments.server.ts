import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { access, audited, HttpError } from './access.server'
import type { Audit } from './access.server'
import { actor, mapped } from './bookkeeping.shared.server'
import type { Trx } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import { manage, readInvoice, sent } from './invoices.read.server'
import { createEvent } from './notifications.server'
import { settle } from './payments.settle.server'
import { suggestPayments } from './payments.suggest.server'
import { inOrganisation } from './tenant.server'

const sentInvoices = (trx: Trx, orgId: string) =>
  trx
    .selectFrom('invoices')
    .select([
      'id',
      'number',
      'total',
      sql<string>`due_date::text`.as('due_date'),
      sql<string>`buyer->>'name'`.as('customer'),
      sql<string>`invoice_open(id)`.as('open_ore'),
    ])
    .where('organisation_id', '=', orgId)
    .where('kind', '=', 'invoice')
    .where('status', '=', 'sent')
    .orderBy('number', 'desc')
    .limit(500)
    .execute()

const livePayments = (trx: Trx, orgId: string) =>
  trx
    .selectFrom('invoice_payments as p')
    .innerJoin('bank_transactions as t', 't.id', 'p.bank_transaction_id')
    .select([
      'p.id',
      'p.invoice_id',
      'p.status',
      'p.covers_ore',
      'p.pass',
      'p.confidence',
      'p.reason',
      't.amount_ore',
      't.counterparty',
      sql<string>`t.booking_date::text`.as('booking_date'),
    ])
    .where('p.organisation_id', '=', orgId)
    .where('p.status', '<>', 'rejected')
    .orderBy('p.created_at')
    .execute()

// Incoming payments no invoice claims yet: these need a person.
const unclaimed = (trx: Trx, orgId: string) =>
  trx
    .selectFrom('bank_transactions as t')
    .select([
      't.id',
      't.amount_ore',
      't.counterparty',
      sql<string>`t.booking_date::text`.as('booking_date'),
    ])
    .where('t.organisation_id', '=', orgId)
    .where('t.amount_ore', '>', '0')
    .where(
      sql<boolean>`not exists (select 1 from invoice_payments p where p.bank_transaction_id = t.id and p.status <> 'rejected')`,
    )
    .orderBy('t.booking_date', 'desc')
    .limit(200)
    .execute()

// Every sent invoice with what is left to pay and the payments suggested or confirmed for it.
export const listPayments = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const payments = await livePayments(trx, orgId)
    return {
      invoices: (await sentInvoices(trx, orgId)).map((i) => ({
        id: i.id,
        number: Number(i.number),
        customer: i.customer,
        due_date: i.due_date,
        total: Number(i.total),
        open_ore: Number(i.open_ore),
        payments: payments
          .filter((p) => p.invoice_id === i.id)
          .map((p) => ({
            id: p.id,
            status: p.status,
            covers_ore: Number(p.covers_ore),
            pass: p.pass,
            confidence: Number(p.confidence),
            reason: p.reason,
            // Money that came in beyond what the invoice needed.
            extra_ore: Number(p.amount_ore) - Number(p.covers_ore),
            transaction: {
              booking_date: p.booking_date,
              counterparty: p.counterparty,
            },
          })),
      })),
      unmatched: (await unclaimed(trx, orgId)).map((t) => ({
        ...t,
        amount_ore: Number(t.amount_ore),
      })),
    }
  })

type Suggested = {
  id: string
  invoice_id: string
  bank_transaction_id: string
  covers_ore: string
}

// Posts the settlement, marks the payment confirmed and tells the members who manage invoices.
async function confirm(trx: Trx, orgId: string, userId: string, p: Suggested) {
  // The invoice row lock makes two payments for one invoice take turns.
  await trx
    .selectFrom('invoices')
    .select('id')
    .where('id', '=', p.invoice_id)
    .forUpdate()
    .executeTakeFirstOrThrow()
  const v = sent(await readInvoice(trx, orgId, p.invoice_id))
  const open = await trx
    .selectFrom('invoices')
    .select(sql<string>`invoice_open(id)`.as('open'))
    .where('id', '=', p.invoice_id)
    .executeTakeFirstOrThrow()
  const covers = Number(p.covers_ore)
  if (covers > Number(open.open)) throw new HttpError(409, 'sum_exceeds')
  const tx = await trx
    .selectFrom('bank_transactions')
    .select(['amount_ore', sql<string>`booking_date::text`.as('booking_date')])
    .where('id', '=', p.bank_transaction_id)
    .executeTakeFirstOrThrow()
  const voucher = await settle(
    trx,
    orgId,
    await actor(trx, userId),
    v,
    tx.booking_date,
    covers,
  )
  await trx
    .updateTable('invoice_payments')
    .set({ status: 'confirmed', voucher_id: voucher, decided_at: sql`now()` })
    .where('id', '=', p.id)
    .execute()
  const rest = Number(open.open) - covers
  const extra = Number(tx.amount_ore) - covers
  const type =
    extra > 0
      ? 'invoice_overpaid'
      : rest > 0
        ? 'invoice_part_paid'
        : 'invoice_paid'
  await createEvent(trx, orgId, type, {
    number: String(v.number),
    customer: v.buyer.name,
    amount: String(covers),
    left: String(rest),
    extra: String(extra),
  })
}

// Accept or reject a suggested payment. Accepting posts the settlement; nothing is booked before.
export const decidePayment = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  paymentId: string,
  verdict: 'confirmed' | 'rejected',
  base: Audit,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      await manage(trx, userId, orgId)
      const p = await trx
        .selectFrom('invoice_payments')
        .select([
          'id',
          'invoice_id',
          'bank_transaction_id',
          'covers_ore',
          'status',
        ])
        .where('id', '=', paymentId)
        .where('organisation_id', '=', orgId)
        .forUpdate()
        .executeTakeFirst()
      if (!p) throw new HttpError(404, 'not_found')
      if (p.status !== 'suggested') throw new HttpError(409, 'already_decided')
      if (verdict === 'confirmed') await confirm(trx, orgId, userId, p)
      else {
        await trx
          .updateTable('invoice_payments')
          .set({ status: 'rejected', decided_at: sql`now()` })
          .where('id', '=', paymentId)
          .execute()
        await suggestPayments(trx, orgId)
      }
      await audited(trx, 'invoice_payment_decided', base, orgId, {
        payment: paymentId,
        verdict,
      })
    }),
  )

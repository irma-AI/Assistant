import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import { HttpError } from './access.server'
import { history, manage, mapped } from './bookkeeping.shared.server'
import type { Actor, Trx } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'
import { draft, readVoucher, yearFor } from './vouchers.server'

export async function post(trx: Trx, orgId: string, id: string, who: Actor) {
  const lines = await trx
    .selectFrom('voucher_lines')
    .select(['debit', 'credit'])
    .where('organisation_id', '=', orgId)
    .where('voucher_id', '=', id)
    .execute()
  const debit = lines.reduce((s, l) => s + Number(l.debit), 0)
  const credit = lines.reduce((s, l) => s + Number(l.credit), 0)
  if (debit !== credit || debit === 0) throw new HttpError(422, 'unbalanced')
  const v = await trx
    .updateTable('vouchers')
    .set({
      status: 'posted',
      posted_by: who.id,
      posted_by_name: who.name,
      app_version: who.version,
    })
    .where('organisation_id', '=', orgId)
    .where('id', '=', id)
    .returning('number')
    .executeTakeFirstOrThrow()
  await history(
    trx,
    orgId,
    who,
    'voucher_posted',
    { number: String(v.number) },
    id,
  )
}

export const postVoucher = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      await draft(trx, orgId, id)
      await post(trx, orgId, id, who)
      return readVoucher(trx, orgId, id)
    }),
  )

// Storno (BFNAR 2013:2 point 2.17): a new voucher with the sides swapped, dated when the error was found, linked to
// the original, which then reads reversed. Neither is ever edited.
export const reverseVoucher = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  date?: string,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      const o = await trx
        .selectFrom('vouchers')
        .select(['status', 'reverses_id', 'description'])
        .where('organisation_id', '=', orgId)
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst()
      if (!o) throw new HttpError(404, 'not_found')
      if (o.status !== 'posted' || o.reverses_id)
        throw new HttpError(409, 'not_reversible')
      const day = date ?? new Date().toISOString().slice(0, 10)
      const s = await trx
        .insertInto('vouchers')
        .values({
          organisation_id: orgId,
          fiscal_year_id: await yearFor(trx, orgId, day),
          voucher_date: day,
          description: `Storno: ${o.description}`.slice(0, 500),
          created_by: who.id,
          created_by_name: who.name,
          reverses_id: id,
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      await sql`
        insert into voucher_lines (organisation_id, voucher_id, line_no, account, debit, credit, text)
        select organisation_id, ${s.id}::uuid, line_no, account, credit, debit, text from voucher_lines where organisation_id = ${orgId}::uuid and voucher_id = ${id}`.execute(
        trx,
      )
      await post(trx, orgId, s.id, who)
      await trx
        .updateTable('vouchers')
        .set({ status: 'reversed' })
        .where('organisation_id', '=', orgId)
        .where('id', '=', id)
        .execute()
      await history(trx, orgId, who, 'voucher_reversed', { storno: s.id }, id)
      return readVoucher(trx, orgId, s.id)
    }),
  )

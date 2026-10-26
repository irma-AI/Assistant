import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { DB } from './db.gen'
import { createEvent } from './notifications.server'
import { suggestPayments } from './payments.suggest.server'
import { inOrganisation } from './tenant.server'

const day = 86_400_000

// Run hourly by the job queue: finds payments for the open invoices, and tells the members who manage invoices that
// one falls due tomorrow, or is overdue (the first day, then every week until it is paid or credited). The
// invoice_watch row makes it idempotent: a retry or a second run tells nobody twice. `today` is a date, for tests.
// shortcut: visits every organisation each hour, shard by organisation when that takes longer than the hour.
export async function watchInvoices(db: Kysely<DB>, today?: string) {
  const orgs = await db.selectFrom('organisations').select('id').execute()
  for (const org of orgs)
    await inOrganisation(db, org.id, async (trx) => {
      await suggestPayments(trx, org.id)
      const now =
        today ??
        (await sql<{ d: string }>`select current_date::text as d`.execute(trx))
          .rows[0]?.d ??
        ''
      const open = await trx
        .selectFrom('invoices')
        .select([
          'id',
          'number',
          sql<string>`due_date::text`.as('due_date'),
          sql<string>`buyer->>'name'`.as('customer'),
          sql<string>`invoice_open(id)`.as('open_ore'),
        ])
        .where('organisation_id', '=', org.id)
        .where('kind', '=', 'invoice')
        .where('status', '=', 'sent')
        .where(sql<boolean>`invoice_open(id) > 0`)
        .execute()
      for (const i of open) {
        const late = Math.round(
          (Date.parse(now) - Date.parse(i.due_date)) / day,
        )
        const key =
          late === -1
            ? 'due_soon'
            : late >= 1
              ? `overdue:${String(Math.floor((late - 1) / 7))}`
              : undefined
        if (!key) continue
        const first = await trx
          .insertInto('invoice_watch')
          .values({ organisation_id: org.id, invoice_id: i.id, key })
          .onConflict((oc) => oc.doNothing())
          .returning('key')
          .executeTakeFirst()
        if (first)
          await createEvent(
            trx,
            org.id,
            late < 0 ? 'invoice_due_soon' : 'invoice_overdue',
            {
              number: String(Number(i.number)),
              customer: i.customer,
              left: String(Number(i.open_ore)),
              date: i.due_date,
            },
          )
      }
    })
}

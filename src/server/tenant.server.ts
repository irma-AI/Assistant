import { sql } from 'kysely'
import type { Kysely, Transaction } from 'kysely'
import type { DB } from './db.gen'

// Runs fn in a transaction whose row level security policies see only this organisation's rows.
// set_config(..., true) is SET LOCAL: it ends with the transaction, so a pooled connection never keeps it.
export function inOrganisation<T>(
  db: Kysely<DB>,
  organisationId: string,
  fn: (trx: Transaction<DB>) => Promise<T>,
) {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.organisation_id', ${organisationId}, true)`.execute(
      trx,
    )
    return fn(trx)
  })
}

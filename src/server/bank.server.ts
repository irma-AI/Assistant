import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { Audit } from './access.server'
import { access, audited, HttpError, require } from './access.server'
import { dedupKeys, parseStatement } from './bank.parse.server'
import type { DB } from './db.gen'
import { suggestPayments } from './payments.suggest.server'
import { suggest } from './receipts.suggest.server'
import { inOrganisation } from './tenant.server'

export const maxBytes = 10 * 1024 * 1024

// Every member may read; bank.manage is needed to add an account or import a file.
export const listAccounts = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return trx
      .selectFrom('bank_accounts')
      .select(['id', 'title', 'created_at'])
      .where('organisation_id', '=', orgId)
      .orderBy('created_at')
      .execute()
  })

export const createAccount = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  title: string,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'bank.manage')
    const row = await trx
      .insertInto('bank_accounts')
      .values({ organisation_id: orgId, title })
      .returning(['id', 'title', 'created_at'])
      .executeTakeFirstOrThrow()
    await audited(trx, 'bank_account_created', base, orgId, { account: row.id })
    return row
  })

const accountIn = async (trx: Kysely<DB>, orgId: string, id: string) => {
  const a = await trx
    .selectFrom('bank_accounts')
    .select('id')
    .where('id', '=', id)
    .where('organisation_id', '=', orgId)
    .executeTakeFirst()
  if (!a) throw new HttpError(404, 'not_found')
}

export const importStatement = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  accountId: string,
  fileName: string,
  bytes: Uint8Array,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'bank.manage')
    if (!bytes.length || !fileName || fileName.length > 255)
      throw new HttpError(400, 'bad_request', false)
    if (bytes.length > maxBytes) throw new HttpError(413, 'too_large', false)
    await accountIn(trx, orgId, accountId)
    const { format, lines } = parseStatement(bytes)
    const keys = dedupKeys(accountId, lines)
    const batch = await trx
      .insertInto('bank_imports')
      .values({
        organisation_id: orgId,
        bank_account_id: accountId,
        file_name: fileName,
        format,
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    let added = 0
    for (let i = 0; i < lines.length; i += 500) {
      const inserted = await trx
        .insertInto('bank_transactions')
        .values(
          lines.slice(i, i + 500).map((l, j) => ({
            organisation_id: orgId,
            bank_account_id: accountId,
            bank_import_id: batch.id,
            bank_id: l.bankId,
            dedup_key: keys[i + j] ?? '',
            amount_ore: l.amountOre,
            booking_date: l.bookingDate,
            value_date: l.valueDate,
            counterparty: l.counterparty,
            reference: l.reference,
            source: 'file',
          })),
        )
        .onConflict((oc) =>
          oc.columns(['bank_account_id', 'dedup_key']).doNothing(),
        )
        .returning('id')
        .execute()
      added += inserted.length
    }
    const result = await trx
      .updateTable('bank_imports')
      .set({ added, skipped: lines.length - added })
      .where('id', '=', batch.id)
      .returning([
        'id',
        'file_name',
        'format',
        'added',
        'skipped',
        'created_at',
      ])
      .executeTakeFirstOrThrow()
    await suggest(trx, orgId)
    await suggestPayments(trx, orgId)
    await audited(trx, 'bank_statement_imported', base, orgId, {
      account: accountId,
      import: batch.id,
    })
    return result
  })

export const listImports = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  accountId: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    await accountIn(trx, orgId, accountId)
    return trx
      .selectFrom('bank_imports')
      .select(['id', 'file_name', 'format', 'added', 'skipped', 'created_at'])
      .where('bank_account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .execute()
  })

export const listTransactions = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  accountId: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    await accountIn(trx, orgId, accountId)
    const rows = await trx
      .selectFrom('bank_transactions')
      .select([
        'id',
        'bank_import_id',
        'bank_id',
        'amount_ore',
        sql<string>`booking_date::text`.as('booking_date'),
        sql<string | null>`value_date::text`.as('value_date'),
        'counterparty',
        'reference',
        'source',
      ])
      .where('bank_account_id', '=', accountId)
      .orderBy('booking_date', 'desc')
      .orderBy('created_at', 'desc')
      .limit(1000)
      .execute()
    // bigint reaches Node as a string; an öre amount stays far inside Number's exact range.
    return rows.map((r) => ({ ...r, amount_ore: Number(r.amount_ore) }))
  })

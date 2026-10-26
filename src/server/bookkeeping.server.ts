import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import type { accountEdit, newAccount, newFiscalYear } from '#/api/bookkeeping'
import { access, HttpError, lockOrg } from './access.server'
import { code, history, manage, mapped } from './bookkeeping.shared.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

// ---- Fiscal years and period locks

const yearColumns = [
  'id',
  sql<string>`starts_on::text`.as('starts_on'),
  sql<string>`ends_on::text`.as('ends_on'),
  sql<string | null>`locked_through::text`.as('locked_through'),
  sql<string>`retain_until::text`.as('retain_until'),
] as const

// Any member may read the books; bookkeeping.manage changes them.
export const listFiscalYears = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return trx
      .selectFrom('fiscal_years')
      .select(yearColumns)
      .where('organisation_id', '=', orgId)
      .orderBy('starts_on')
      .execute()
  })

// The first fiscal year also gives the organisation its chart: a copy of the newest BAS version.
export const createFiscalYear = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: z.output<typeof newFiscalYear>,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      await lockOrg(trx, orgId)
      const who = await manage(trx, userId, orgId)
      const year = await trx
        .insertInto('fiscal_years')
        .values({ organisation_id: orgId, ...input })
        .returning(yearColumns)
        .executeTakeFirstOrThrow()
      await history(trx, orgId, who, 'fiscal_year_created', input)
      const has = await trx
        .selectFrom('accounts')
        .select('number')
        .where('organisation_id', '=', orgId)
        .limit(1)
        .executeTakeFirst()
      if (!has) {
        const bas = await trx
          .selectFrom('bas_versions')
          .select('version')
          .orderBy('version', 'desc')
          .executeTakeFirstOrThrow()
        const seeded = await sql`
          insert into accounts (organisation_id, number, name, not_k2, bas_version)
          select ${orgId}::uuid, number, name, not_k2, version from bas_accounts where version = ${bas.version}`.execute(
          trx,
        )
        await history(trx, orgId, who, 'chart_seeded', {
          bas_version: bas.version,
          accounts: Number(seeded.numAffectedRows ?? 0),
        })
      }
      return year
    }),
  )

// Nothing dated on or before the date can be posted any more. The lock only moves forward.
export const lockFiscalYear = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  yearId: string,
  lockedThrough: string,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      const before = await trx
        .selectFrom('fiscal_years')
        .select('id')
        .where('organisation_id', '=', orgId)
        .where('id', '=', yearId)
        .forUpdate()
        .executeTakeFirst()
      if (!before) throw new HttpError(404, 'not_found')
      const year = await trx
        .updateTable('fiscal_years')
        .set({ locked_through: lockedThrough })
        .where('organisation_id', '=', orgId)
        .where('id', '=', yearId)
        .returning(yearColumns)
        .executeTakeFirstOrThrow()
      await history(trx, orgId, who, 'period_locked', {
        fiscal_year: yearId,
        locked_through: lockedThrough,
      })
      return year
    }),
  ).catch((e: unknown) => {
    // Moving the lock back is the trigger's refusal.
    if (code(e) === '23001') throw new HttpError(409, 'period_lock_backwards')
    throw e
  })

// ---- Chart of accounts

const accountColumns = [
  'number',
  'name',
  'not_k2',
  'active',
  'bas_version',
] as const

export const listAccounts = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return trx
      .selectFrom('accounts')
      .select(accountColumns)
      .where('organisation_id', '=', orgId)
      .orderBy('number')
      .execute()
  })

// An account is never deleted (posted lines point at it); it is switched off instead.
export const addAccount = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: z.output<typeof newAccount>,
) =>
  mapped(() =>
    inOrganisation(db, orgId, async (trx) => {
      const who = await manage(trx, userId, orgId)
      const row = await trx
        .insertInto('accounts')
        .values({ organisation_id: orgId, ...input })
        .returning(accountColumns)
        .executeTakeFirstOrThrow()
      await history(trx, orgId, who, 'account_added', { account: input.number })
      return row
    }),
  )

export const editAccount = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  number: string,
  input: z.output<typeof accountEdit>,
) =>
  inOrganisation(db, orgId, async (trx) => {
    const who = await manage(trx, userId, orgId)
    const row = await trx
      .updateTable('accounts')
      .set(input)
      .where('organisation_id', '=', orgId)
      .where('number', '=', number)
      .returning(accountColumns)
      .executeTakeFirst()
    if (!row) throw new HttpError(404, 'not_found')
    await history(trx, orgId, who, 'account_changed', {
      account: number,
      fields: Object.keys(input).join(','),
    })
    return row
  })

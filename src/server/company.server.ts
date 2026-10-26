import { sql } from 'kysely'
import type { Kysely } from 'kysely'
import type { z } from 'zod'
import { vatNumber } from '#/api/company'
import type { companyInput } from '#/api/company'
import type { Audit } from './access.server'
import { access, audited, HttpError, lockOrg, require } from './access.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

type Input = z.output<typeof companyInput>

const columns = [
  'org_number',
  'legal_name',
  'company_form',
  'seat',
  'street',
  'postal_code',
  'city',
  'f_skatt',
  'vat_period',
  'accounting_method',
  'payment_kind',
  'payment_number',
  'swish',
  'contact_email',
  'contact_phone',
  'fiscal_year_start',
  'fiscal_year_end',
] as const

// Dates travel as 2026-01-01, not as timestamps.
const shown = [
  ...columns.slice(0, -2),
  sql<string>`fiscal_year_start::text`.as('fiscal_year_start'),
  sql<string>`fiscal_year_end::text`.as('fiscal_year_end'),
]

const read = (db: Kysely<DB>, orgId: string) =>
  db
    .selectFrom('company_details')
    .select(shown)
    .where('organisation_id', '=', orgId)

const withVat = <T extends { org_number: string }>(row: T) => ({
  ...row,
  vat_number: vatNumber(row.org_number),
})

// Any member may read; null until the details are first saved.
export const getCompany = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const row = await read(trx, orgId).executeTakeFirst()
    return row ? withVat(row) : null
  })

// What changes is audited as field names only, never values. A fiscal year or accounting method change
// is flagged for the processing history (BFNAR 2013:2 point 9.16), which IRM-151 will hold.
export async function saveCompany(
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: Input,
  base: Audit,
) {
  try {
    return await inOrganisation(db, orgId, async (trx) => {
      await lockOrg(trx, orgId)
      await require(trx, userId, orgId, 'organisation.manage')
      const before = await read(trx, orgId).forUpdate().executeTakeFirst()
      // Dates come back as Date objects; compare as the text that was stored.
      const row = await trx
        .insertInto('company_details')
        .values({ organisation_id: orgId, ...input })
        .onConflict((oc) =>
          oc
            .column('organisation_id')
            .doUpdateSet({ ...input, updated_at: new Date() }),
        )
        .returning(shown)
        .executeTakeFirstOrThrow()
      const changed = columns.filter(
        (c) => String(before?.[c] ?? null) !== String(row[c] ?? null),
      )
      if (changed.length)
        await audited(trx, 'company_updated', base, orgId, {
          fields: changed.join(','),
          history: String(
            changed.some((c) =>
              [
                'fiscal_year_start',
                'fiscal_year_end',
                'accounting_method',
              ].includes(c),
            ),
          ),
        })
      return withVat(row)
    })
  } catch (e) {
    // The org number is unique across all live organisations; the screen never names the holder.
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      e.code === '23505'
    )
      throw new HttpError(409, 'org_number_taken')
    throw e
  }
}

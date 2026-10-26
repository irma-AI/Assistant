import type { Kysely } from 'kysely'
import type { z } from 'zod'
import { customerFields, parseCsv } from '#/api/customers'
import { newCustomer } from '#/api/schemas'
import type { customerImport } from '#/api/schemas'
import type { Audit } from './access.server'
import { access, audited, HttpError, require } from './access.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

type Customer = z.output<typeof newCustomer>

const columns = [
  'id',
  'kind',
  'name',
  'address',
  'email',
  'language',
  'org_number',
  'vat_number',
  'contact',
  'payment_terms_days',
] as const

// Every member may read; customers.manage is needed to change anything.
export const listCustomers = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return trx
      .selectFrom('customers')
      .select(columns)
      .where('organisation_id', '=', orgId)
      .orderBy('name')
      .execute()
  })

export const createCustomer = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: Customer,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'customers.manage')
    const row = await trx
      .insertInto('customers')
      .values({ ...input, organisation_id: orgId })
      .returning('id')
      .executeTakeFirstOrThrow()
    await audited(trx, 'customer_created', base, orgId, { customer: row.id })
    return row
  })

export const updateCustomer = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  input: Customer,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'customers.manage')
    const done = await trx
      .updateTable('customers')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .where('organisation_id', '=', orgId)
      .executeTakeFirst()
    if (!done.numUpdatedRows) throw new HttpError(404, 'not_found')
    await audited(trx, 'customer_updated', base, orgId, { customer: id })
  })

export const deleteCustomer = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'customers.manage')
    const done = await trx
      .deleteFrom('customers')
      .where('id', '=', id)
      .where('organisation_id', '=', orgId)
      .executeTakeFirst()
    if (!done.numDeletedRows) throw new HttpError(404, 'not_found')
    await audited(trx, 'customer_deleted', base, orgId, { customer: id })
  })

const kinds: Record<string, string> = {
  företag: 'business',
  business: 'business',
  privat: 'consumer',
  privatperson: 'consumer',
  consumer: 'consumer',
}

// One CSV line as the fields of a customer; empty cells and unmapped columns are left out.
function rowFields(
  header: string[],
  line: string[],
  mapping: Record<string, string>,
) {
  const raw: Record<string, string | number> = { kind: 'business' }
  for (const field of customerFields) {
    const column = header.indexOf(mapping[field] || '\0')
    const cell = line[column]?.trim()
    if (column < 0 || !cell) continue
    if (field === 'kind') raw[field] = kinds[cell.toLowerCase()] ?? cell
    else raw[field] = field === 'payment_terms_days' ? Number(cell) : cell
  }
  return raw
}

// Checks every row, and saves them all in one transaction only when `commit` is set and none is invalid.
export const importCustomers = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  input: z.output<typeof customerImport>,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'customers.manage')
    const [header = [], ...lines] = (() => {
      try {
        return parseCsv(input.csv)
      } catch {
        throw new HttpError(400, 'bad_request', false)
      }
    })()
    if (lines.length > 1000) throw new HttpError(400, 'bad_request', false)
    const valid: Customer[] = []
    const errors: { row: number; fields: string[] }[] = []
    lines.forEach((line, i) => {
      // Blank lines keep their place so a reported row matches the file.
      if (!line.some((x) => x.trim())) return
      const parsed = newCustomer.safeParse(
        rowFields(header, line, input.mapping),
      )
      if (parsed.success) valid.push(parsed.data)
      else
        errors.push({
          row: i + 2,
          fields: [
            ...new Set(
              parsed.error.issues.map((x) => String(x.path[0] ?? 'kind')),
            ),
          ],
        })
    })
    const saved = input.commit && !errors.length && valid.length > 0
    if (saved) {
      await trx
        .insertInto('customers')
        .values(valid.map((c) => ({ ...c, organisation_id: orgId })))
        .execute()
      await audited(trx, 'customers_imported', base, orgId, {
        count: String(valid.length),
      })
    }
    return { rows: valid.length + errors.length, errors, saved }
  })

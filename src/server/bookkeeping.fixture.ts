import type { Transaction } from 'kysely'
import { expect } from 'vitest'
import { z } from 'zod'
import { bookkeepingApi as api } from './bookkeeping.api.server'
import { db, newOrg, person, req } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

export const voucher = z.object({
  id: z.string(),
  status: z.string(),
  number: z.number().nullable(),
  fiscal_year_id: z.string(),
  reverses_id: z.string().nullable(),
  reversed_by: z.object({ number: z.number().nullable() }).nullable(),
  totals: z.object({ balanced: z.boolean() }),
})
export const id = z.object({ id: z.string() })

export const lines = (amount = 12500) => [
  { account: '1930', debit: amount, credit: 0 },
  { account: '3001', debit: 0, credit: amount },
]
export const draft = (date = '2026-03-10', l = lines()) => ({
  voucher_date: date,
  description: 'Försäljning',
  lines: l,
})

export async function books() {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const r = await api.createYear(
    req(owner, 'POST', { starts_on: '2026-01-01', ends_on: '2026-12-31' }),
    org,
    db,
  )
  const body: unknown = await r.json()
  if (r.status !== 201) throw new Error(JSON.stringify(body))
  const year = id.parse(body).id
  return { owner, org, year }
}
export const newDraft = async (
  p: Person,
  org: string,
  body: object = draft(),
) =>
  voucher.parse(
    await (await api.createVoucher(req(p, 'POST', body), org, db)).json(),
  )
export const post = (p: Person, org: string, v: string) =>
  api.post(req(p, 'POST'), org, v, db)
export const booked = async (
  p: Person,
  org: string,
  body: object = draft(),
) => {
  const d = await newDraft(p, org, body)
  const r = await post(p, org, d.id)
  expect(r.status).toBe(200)
  return voucher.parse(await r.json())
}
export const raw = <T>(org: string, fn: (t: Transaction<DB>) => Promise<T>) =>
  inOrganisation(db, org, fn)

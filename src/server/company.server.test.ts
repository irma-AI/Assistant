import { expect, test } from 'vitest'
import { z } from 'zod'
import { company, luhn } from '#/api/company'
import { orgsApi } from './orgs.api.server'
import { addMember, db, newOrg, person, req, useDatabase } from './orgs.fixture'
import type { Person } from './orgs.fixture'

useDatabase()

// A different valid number per call, so tests can share one database.
let next = 556000000
const orgNo = () => {
  next += 1
  const digits = String(next)
  const check = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) =>
    luhn(`${digits}${String(d)}`),
  )
  return `${digits}${String(check)}`
}

const base = {
  org_number: '5560160680',
  legal_name: 'Bolaget AB',
  company_form: 'ab',
  seat: 'Stockholm',
  street: 'Storgatan 1',
  postal_code: '11122',
  city: 'Stockholm',
  f_skatt: true,
  vat_period: 'quarterly',
  accounting_method: 'invoice',
  payment_kind: 'bankgiro',
  payment_number: '123-4567',
  swish: null,
  contact_email: 'info@example.com',
  contact_phone: null,
  fiscal_year_start: '2026-01-01',
  fiscal_year_end: '2026-12-31',
}
const mine = (over: object = {}) => ({
  ...base,
  org_number: orgNo(),
  ...over,
})

const save = (p: Person, org: string, body: object) =>
  orgsApi.saveCompany(req(p, 'PUT', body), org, db)
const load = async (p: Person, org: string) =>
  company.parse(await (await orgsApi.company(req(p, 'GET'), org, db)).json())

test('Luhn accepts a real number and rejects a changed digit', () => {
  expect(luhn('5560160680')).toBe(true)
  expect(luhn('5560160681')).toBe(false)
})

test('saving derives the VAT number, and any member reads it', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  expect(await load(owner, org.id)).toBeNull()
  expect((await save(owner, org.id, base)).status).toBe(200)
  const member = await person()
  await addMember(owner, org.id, member, 'Medlem')
  expect(await load(member, org.id)).toMatchObject({
    org_number: '5560160680',
    vat_number: 'SE556016068001',
    fiscal_year_start: '2026-01-01',
  })
})

test('a bad check digit or a fiscal year over 18 months is refused', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const bad = mine({ org_number: '5560160681' })
  expect((await save(owner, org.id, bad)).status).toBe(400)
  const long = mine({ fiscal_year_end: '2027-07-01' })
  expect((await save(owner, org.id, long)).status).toBe(400)
  const short = mine({ fiscal_year_end: '2027-06-30' })
  expect((await save(owner, org.id, short)).status).toBe(200)
})

test('only organisation.manage may save', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const member = await person()
  await addMember(owner, org.id, member, 'Medlem')
  expect((await save(member, org.id, mine())).status).toBe(403)
  expect((await save(await person(), org.id, mine())).status).toBe(404)
})

test('an org number is held by one organisation until it is deleted', async () => {
  const a = await person()
  const b = await person()
  const first = await newOrg(a)
  const second = await newOrg(b)
  const same = mine()
  expect((await save(a, first.id, same)).status).toBe(200)
  const taken = await save(b, second.id, same)
  expect(taken.status).toBe(409)
  expect(z.object({ error: z.string() }).parse(await taken.json()).error).toBe(
    'org_number_taken',
  )
  await db.deleteFrom('organisations').where('id', '=', first.id).execute()
  expect((await save(b, second.id, same)).status).toBe(200)
})

test('a change is audited by field name, not value', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const first = mine()
  await save(owner, org.id, first)
  await save(owner, org.id, { ...first, accounting_method: 'cash' })
  const rows = await db
    .selectFrom('audit_events')
    .select('detail')
    .where('event', '=', 'company_updated')
    .where('user_id', '=', owner.id)
    .orderBy('id')
    .execute()
  expect(rows.at(-1)?.detail).toMatchObject({
    fields: 'accounting_method',
    history: 'true',
  })
  expect(JSON.stringify(rows)).not.toContain('cash')
})

import { expect, test } from 'vitest'
import { z } from 'zod'
import { bankApi } from './bank.api.server'
import { db, idOf, newOrg, person, useDatabase } from './orgs.fixture'

useDatabase()

const size = 2500
const get = (token: string, org: string, account: string, query = '') =>
  bankApi.transactions(
    new Request(`https://api.test/api/v1/x${query}`, {
      headers: { authorization: `Bearer ${token}` },
    }),
    org,
    account,
    db,
  )
const page = z.object({
  items: z.array(z.object({ id: z.string(), booking_date: z.string() })),
  next: z.string().nullable(),
})

test('the transaction list pages through every row, newest first, with no row twice', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const account = (
    await idOf(
      await bankApi.createAccount(
        new Request('https://api.test/api/v1/x', {
          method: 'POST',
          headers: { authorization: `Bearer ${owner.token}` },
          body: JSON.stringify({ title: 'Företagskonto' }),
        }),
        org,
        db,
      ),
    )
  ).id
  const lines = Array.from(
    { length: size },
    (_, i) =>
      `2026-03-${String((i % 28) + 1).padStart(2, '0')};2026-03-01;V${String(i)};Kund ${String(i)};10,00;100,00`,
  )
  const file = new TextEncoder().encode(
    [
      'Bokföringsdag;Valutadag;Verifikationsnummer;Text/mottagare;Belopp;Saldo',
      ...lines,
    ].join('\n'),
  )
  const imported = await bankApi.import(
    new Request('https://api.test/api/v1/x?name=utdrag', {
      method: 'POST',
      headers: { authorization: `Bearer ${owner.token}` },
      body: new Blob([file]),
    }),
    org,
    account,
    db,
  )
  expect(imported.status).toBe(201)
  const seen: z.infer<typeof page>['items'] = []
  let query = ''
  let pages = 0
  for (;;) {
    const r = page.parse(
      await (await get(owner.token, org, account, query)).json(),
    )
    seen.push(...r.items)
    pages++
    if (!r.next) break
    query = `?cursor=${encodeURIComponent(r.next)}`
  }
  expect(pages).toBe(3)
  expect(new Set(seen.map((r) => r.id)).size).toBe(size)
  const dates = seen.map((r) => r.booking_date)
  expect(dates).toEqual([...dates].sort().reverse())
  expect((await get(owner.token, org, account, '?cursor=junk')).status).toBe(
    400,
  )
})

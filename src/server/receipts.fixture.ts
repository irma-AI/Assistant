import { z } from 'zod'
import { db, idOf, req } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { receiptsApi } from './receipts.api.server'
import { inOrganisation } from './tenant.server'

export const pdf = (n: number) =>
  new TextEncoder().encode(`%PDF-1.7 made-up ${String(n)}`)
let counter = 0
export const upload = async (p: Person, org: string) =>
  idOf(
    await receiptsApi.upload(
      new Request('https://api.test/api/v1/x?name=kvitto.pdf', {
        method: 'POST',
        headers: { authorization: `Bearer ${p.token}` },
        body: new Blob([pdf(counter++)]),
      }),
      org,
      db,
    ),
  )
export const fill = (p: Person, org: string, id: string, body: object) =>
  receiptsApi.update(req(p, 'PATCH', body), org, id, db)
export const match = z.object({
  id: z.string(),
  status: z.string(),
  pass: z.number().nullable(),
  confidence: z.number().nullable(),
  reason: z.string().nullable(),
  covers_ore: z.number(),
  transaction: z.object({ id: z.string() }),
})
export const receiptRow = z.object({
  id: z.string(),
  matches: z.array(match),
  suggested_account: z.object({ number: z.string() }).nullable(),
  suggested_vat_account: z.object({ number: z.string() }).nullable(),
})
export const list = async (p: Person, org: string) =>
  z
    .array(receiptRow)
    .parse(await (await receiptsApi.list(req(p, 'GET'), org, db)).json())
export const unmatched = async (p: Person, org: string) =>
  z
    .array(z.object({ id: z.string() }))
    .parse(await (await receiptsApi.unmatched(req(p, 'GET'), org, db)).json())

// A bank account with payments typed in directly: the import itself is tested in bank.server.test.ts.
export async function bankWith(
  org: string,
  rows: { amount: number; date: string; text: string; ref?: string }[],
) {
  return inOrganisation(db, org, async (t) => {
    const a = await t
      .insertInto('bank_accounts')
      .values({ organisation_id: org, title: 'Företagskonto' })
      .returning('id')
      .executeTakeFirstOrThrow()
    const b = await t
      .insertInto('bank_imports')
      .values({
        organisation_id: org,
        bank_account_id: a.id,
        file_name: 'x',
        format: 'test',
      })
      .returning('id')
      .executeTakeFirstOrThrow()
    const ids: string[] = []
    for (const [i, r] of rows.entries()) {
      const tx = await t
        .insertInto('bank_transactions')
        .values({
          organisation_id: org,
          bank_account_id: a.id,
          bank_import_id: b.id,
          dedup_key: `k${String(i)}${org}`,
          amount_ore: r.amount,
          booking_date: r.date,
          counterparty: r.text,
          reference: r.ref ?? null,
          source: 'file',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
      ids.push(tx.id)
    }
    return ids
  })
}

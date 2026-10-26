import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'kysely'
import { beforeAll, expect, test } from 'vitest'
import { z } from 'zod'
import { db, newOrg, person, req, useDatabase } from './orgs.fixture'
import { receiptsApi } from './receipts.api.server'
import { bankWith, fill, list, unmatched, upload } from './receipts.fixture'
import { ingestMessage } from './receipts.mail.server'
import { inOrganisation } from './tenant.server'

// Counterexamples from the skeptic pass on IRM-147, each failing before its fix.
useDatabase()
beforeAll(async () => {
  process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'receipt-edge-'))
})

const link = (
  p: Awaited<ReturnType<typeof person>>,
  org: string,
  r: string,
  tx: string,
) => receiptsApi.link(req(p, 'POST', { transactionId: tx }), org, r, db)

test('a payment of 5 kr or less with no receipt is listed as unmatched', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const [tx] = await bankWith(org, [
    { amount: -300, date: '2026-03-05', text: 'Parkering' },
  ])
  expect((await unmatched(owner, org)).map((t) => t.id)).toEqual([tx])
})

test('an empty PATCH is a bad request, and a confirmed receipt keeps its amount', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const [tx] = await bankWith(org, [
    { amount: -5000, date: '2026-03-05', text: 'Okänd' },
  ])
  const r = await upload(owner, org)
  expect((await fill(owner, org, r.id, {})).status).toBe(400)
  await fill(owner, org, r.id, { amount_ore: 5000 })
  expect((await link(owner, org, r.id, tx ?? '')).status).toBe(201)
  expect((await fill(owner, org, r.id, { amount_ore: 100 })).status).toBe(409)
  expect((await fill(owner, org, r.id, { supplier: 'Nytt' })).status).toBe(204)
})

test('editing the amount drops a suggestion that no longer fits, so it cannot be confirmed stale', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  await bankWith(org, [{ amount: -10000, date: '2026-03-05', text: 'Okänd' }])
  const r = await upload(owner, org)
  await fill(owner, org, r.id, {
    amount_ore: 10000,
    receipt_date: '2026-03-01',
  })
  expect((await list(owner, org))[0]?.matches).toHaveLength(1)
  await fill(owner, org, r.id, { amount_ore: 5000 })
  expect((await list(owner, org))[0]?.matches).toEqual([])
})

test('the strongest pass wins a payment whatever the order of the receipts', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const [tx] = await bankWith(org, [
    { amount: -10000, date: '2026-03-05', text: 'Exempelkafé', ref: '998877' },
  ])
  const weak = await upload(owner, org)
  const strong = await upload(owner, org)
  await fill(owner, org, weak.id, {
    supplier: 'Exempelkafé',
    amount_ore: 10300,
  })
  await fill(owner, org, strong.id, {
    amount_ore: 10000,
    reference: '00998877',
  })
  const rows = await list(owner, org)
  expect(rows.find((r) => r.id === strong.id)?.matches).toMatchObject([
    { pass: 1, transaction: { id: tx } },
  ])
  expect(rows.find((r) => r.id === weak.id)?.matches).toEqual([])
})

test('a one-letter supplier name matches nothing', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  await bankWith(org, [
    { amount: -10000, date: '2026-09-05', text: 'Kafé Exempel' },
  ])
  const r = await upload(owner, org)
  await fill(owner, org, r.id, {
    supplier: 'A',
    amount_ore: 10000,
    receipt_date: '2026-01-01',
  })
  expect((await list(owner, org))[0]?.matches).toEqual([])
})

test('an oversize or unreadable attachment does not stop the rest of the mail', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  process.env.RECEIPT_MAIL_ADDRESS = 'kvitto@example.test'
  const inbox = z
    .object({ inbox: z.string() })
    .parse(
      await (await receiptsApi.settings(req(owner, 'GET'), org, db)).json(),
    )
  const part = (name: string, body: Buffer) =>
    [
      '--b',
      `Content-Type: application/octet-stream; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      body.toString('base64'),
    ].join('\r\n')
  const big = Buffer.concat([
    Buffer.from('%PDF-1.7 '),
    Buffer.alloc(21 * 1024 * 1024),
  ])
  const raw = Buffer.from(
    [
      'From: x@example.test',
      `Bcc-Delivered: yes`,
      `Delivered-To: ${inbox.inbox}`,
      'To: someone@example.test',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="b"',
      '',
      part('stor.pdf', big),
      part('bra.pdf', Buffer.from('%PDF-1.7 fine')),
      '--b--',
      '',
    ].join('\r\n'),
  )
  expect(await ingestMessage(db, raw)).toEqual({ stored: 1, dropped: false })
})

test('turning suggestions off drops the open ones, and a pair already confirmed is not linked twice', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const [tx] = await bankWith(org, [
    { amount: -10000, date: '2026-03-05', text: 'Okänd' },
  ])
  const r = await upload(owner, org)
  await fill(owner, org, r.id, {
    amount_ore: 10000,
    receipt_date: '2026-03-01',
  })
  expect((await list(owner, org))[0]?.matches).toHaveLength(1)
  await receiptsApi.setSettings(
    req(owner, 'PUT', { suggestions: false }),
    org,
    db,
  )
  expect((await list(owner, org))[0]?.matches).toEqual([])
  expect((await link(owner, org, r.id, tx ?? '')).status).toBe(201)
  expect((await link(owner, org, r.id, tx ?? '')).status).toBe(409)
})

test('the app role finds an organisation by its inbox code but sees no other organisation rows', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const other = (await newOrg(await person())).id
  process.env.RECEIPT_MAIL_ADDRESS = 'kvitto@example.test'
  await receiptsApi.settings(req(owner, 'GET'), org, db)
  const r = await upload(owner, org)
  await inOrganisation(db, org, async (t) => {
    await sql`set local role assistant_app`.execute(t)
    const own = await sql<{
      n: string
    }>`select count(*) as n from receipts`.execute(t)
    expect(own.rows[0]?.n).toBe('1')
    const code = await sql<{
      inbox_code: string
    }>`select inbox_code from receipt_settings`.execute(t)
    expect(code.rows).toHaveLength(1)
    const found = await sql<{ id: string | null }>`
      select organisation_for_inbox(${code.rows[0]?.inbox_code ?? ''}) as id`.execute(
      t,
    )
    expect(found.rows[0]?.id).toBe(org)
  })
  await inOrganisation(db, other, async (t) => {
    await sql`set local role assistant_app`.execute(t)
    expect(
      (await sql`select 1 from receipts where id = ${r.id}`.execute(t)).rows,
    ).toEqual([])
  })
})

import { expect, test } from '@playwright/test'
import pg from 'pg'

// Needs the in-process fake BankID and the database, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

test('an Ägare uploads a receipt, sees the suggested payment with its reason and accepts it', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(230 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  await page.getByLabel('Namn').fill('Kvitto AB')
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page.getByRole('link', { name: 'Kvitton' }).click()

  await page.getByLabel('Ladda upp kvitto').setInputFiles({
    name: 'kaffe.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 made-up receipt'),
  })
  // No bank screen yet: the payment arrives as an import would store it, before the receipt's facts are saved.
  const orgId = /org\/([^/]+)\//.exec(page.url())?.[1]
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  const account = await client.query<{ id: string }>(
    `insert into bank_accounts (organisation_id, title) values ($1, 'Företagskonto') returning id`,
    [orgId],
  )
  const batch = await client.query<{ id: string }>(
    `insert into bank_imports (organisation_id, bank_account_id, file_name, format) values ($1, $2, 'x', 'test') returning id`,
    [orgId, account.rows[0]?.id],
  )
  await client.query(
    `insert into bank_transactions (organisation_id, bank_account_id, bank_import_id, dedup_key, amount_ore, booking_date, counterparty, source)
     values ($1, $2, $3, 'e2e-1', -12550, '2026-03-10', 'Kafé Exempel', 'file')`,
    [orgId, account.rows[0]?.id, batch.rows[0]?.id],
  )
  await client.end()

  await page.getByLabel('Leverantör').fill('Exempelkafé')
  await page.getByLabel('Belopp (kr)').fill('125,50')
  await page.getByLabel('Datum').fill('2026-03-01')
  await page
    .getByRole('button', { name: /Spara uppgifter för kaffe.pdf/ })
    .click()

  await expect(page.getByText('Förslag: 2026-03-10 Kafé Exempel')).toBeVisible()
  await expect(
    page.getByText('Samma belopp inom betalningstiden, 85 % säker.'),
  ).toBeVisible()
  await page.getByRole('button', { name: /Godkänn förslaget/ }).click()
  await expect(
    page.getByText('Matchad med 2026-03-10 Kafé Exempel'),
  ).toBeVisible()
  await expect(page.getByText('Alla betalningar har kvitto.')).toBeVisible()
})

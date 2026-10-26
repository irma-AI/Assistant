import { expect, test } from '@playwright/test'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

test('an Ägare adds a business customer, imports a CSV and sees them listed', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(250 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByLabel('Namn').fill('Kunder AB')
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page.getByRole('link', { name: 'Kunder' }).click()

  await page.getByRole('button', { name: 'Lägg till kund' }).click()
  await page.getByLabel('Namn').fill('Grannen AB')
  await page.getByLabel('Adress').fill('Storgatan 1, 111 22 Stockholm')
  await page.getByLabel('Organisationsnummer').fill('556016-0680')
  await page.getByRole('button', { name: 'Spara kund' }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Grannen AB' }),
  ).toBeVisible()

  const csv = (rows: string[]) => ({
    name: 'kunder.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(['namn;adress;orgnr', ...rows].join('\n')),
  })
  await page
    .getByLabel('CSV-fil')
    .setInputFiles(csv(['Lilla AB;Vägen 2;', ';Vägen 3;']))
  await page.getByLabel('Kolumn för Namn').selectOption('namn')
  await page.getByLabel('Kolumn för Adress').selectOption('adress')
  await page.getByRole('button', { name: 'Kontrollera filen' }).click()
  // The empty name is reported, and nothing can be saved.
  await expect(page.getByText('Rad 3: ogiltigt Namn')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Spara importen' }),
  ).toHaveCount(0)

  await page.getByLabel('CSV-fil').setInputFiles(csv(['Lilla AB;Vägen 2;']))
  await page.getByLabel('Kolumn för Namn').selectOption('namn')
  await page.getByLabel('Kolumn för Adress').selectOption('adress')
  await page.getByRole('button', { name: 'Kontrollera filen' }).click()
  await page.getByRole('button', { name: 'Spara importen' }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Lilla AB' }),
  ).toBeVisible()
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Grannen AB' }),
  ).toBeVisible()
})

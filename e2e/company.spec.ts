import { expect, test } from '@playwright/test'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

// Org numbers are unique across organisations, so each run makes its own: 55 + seven digits + a Luhn check digit.
function orgNumber(seed: number) {
  const body = `55${String(seed % 10_000_000).padStart(7, '0')}`
  const sum = body.split('').reduce((s, c, i) => {
    const n = Number(c) * (i % 2 ? 1 : 2)
    return s + (n > 9 ? n - 9 : n)
  }, 0)
  return body + String((10 - (sum % 10)) % 10)
}

test('an Ägare saves company details and sees the derived VAT number', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(240 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  // One IP is one person, so earlier runs' organisations may be listed too.
  const name = `Uppgifter ${testInfo.project.name} ${String(Date.now())}`
  await page.getByLabel('Namn').fill(name)
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('link', { name: 'Företagsuppgifter' })
    .click()

  const number = orgNumber(Date.now() * 10 + testInfo.workerIndex)
  await page.getByLabel('Företagsnamn').fill(name)
  await page.getByLabel('Organisationsnummer').fill(number)
  await page.getByLabel('Säte (kommun)').fill('Stockholm')
  await page.getByLabel('Gatuadress').fill('Storgatan 1')
  await page.getByLabel('Postnummer').fill('11122')
  await page.getByLabel('Ort').fill('Stockholm')
  await page.getByLabel('Betalningsnummer').fill('123-4567')
  await page.getByLabel('Räkenskapsår från').fill('2026-01-01')
  await page.getByLabel('Räkenskapsår till').fill('2026-12-31')
  await page.getByRole('button', { name: 'Spara' }).click()

  await expect(page.getByRole('status')).toHaveText('Sparat.')
  await page.reload()
  await expect(page.getByText(`SE${number}01`)).toBeVisible()
  await expect(page.getByLabel('Organisationsnummer')).toHaveValue(number)
})

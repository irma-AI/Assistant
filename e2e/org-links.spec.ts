import { expect, test } from '@playwright/test'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

test('the organisation screen leads to Fakturor and Kvitton without typing an address or reloading', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(150 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  await page.getByLabel('Namn').fill('Länk AB')
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page.evaluate(() => {
    Object.assign(window, { kept: true })
  })
  await page.getByRole('link', { name: 'Fakturor' }).click()
  await expect(page).toHaveURL(/\/org\/[^/]+\/fakturor$/)
  await page.goBack()
  await page.getByRole('link', { name: 'Kvitton' }).click()
  await expect(page).toHaveURL(/\/org\/[^/]+\/kvitton$/)
  expect(await page.evaluate(() => 'kept' in window)).toBe(true)
})

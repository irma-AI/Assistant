import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

async function loginWithOrganisation(page: Page, workerIndex: number) {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(190 + workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  await page.getByLabel('Namn').fill(`Förladdnings AB ${String(Date.now())}`)
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await expect(page.getByRole('link', { name: 'Aviseringar' })).toBeVisible()
}

test("a screen's data is requested when its link is hovered, before the screen opens", async ({
  page,
}, testInfo) => {
  await loginWithOrganisation(page, testInfo.workerIndex)
  const link = page.getByRole('link', { name: 'Aviseringar' })
  const requested = page.waitForRequest(/\/orgs\/[^/]+\/notifications$/)
  await link.hover()
  await requested
  expect(page.url()).toMatch(/\/app\/organisation$/)
})

test('a screen already visited shows its content at once, however slow the server is', async ({
  page,
}, testInfo) => {
  await loginWithOrganisation(page, testInfo.workerIndex)
  const heading = page.getByRole('heading', { level: 1, name: 'Aviseringar' })
  await page.getByRole('link', { name: 'Aviseringar' }).click()
  await expect(heading).toBeVisible()
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  await expect(heading).toBeHidden()

  await page.route(/\/orgs\/[^/]+\/notifications$/, async (route) => {
    await new Promise((done) => setTimeout(done, 3000))
    await route.continue()
  })
  await page.getByRole('link', { name: 'Aviseringar' }).click()
  await expect(heading).toBeVisible({ timeout: 1000 })
  await expect(page.getByText('Laddar…')).toHaveCount(0)
})

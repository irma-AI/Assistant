import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

async function loginWithOrganisation(page: Page, workerIndex: number) {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(180 + workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  const name = `Förladdnings AB ${String(Date.now())}`
  await page.getByLabel('Namn').fill(name)
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  // The test user has many organisations, in no fixed order: stick to the new one.
  const link = page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('link', { name: 'Aviseringar' })
  await expect(link).toBeVisible()
  return link
}

test("a screen's data is requested when its link is hovered, before the screen opens", async ({
  page,
}, testInfo) => {
  const link = await loginWithOrganisation(page, testInfo.workerIndex)
  const requested = page.waitForRequest(/\/orgs\/[^/]+\/notifications$/)
  await link.hover()
  await requested
  expect(page.url()).toMatch(/\/app\/organisation$/)
})

test('a screen already visited shows its content at once, however slow the server is', async ({
  page,
}, testInfo) => {
  const link = await loginWithOrganisation(page, testInfo.workerIndex)
  const heading = page.getByRole('heading', { level: 1, name: 'Aviseringar' })
  await link.click()
  await expect(heading).toBeVisible()
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  await expect(heading).toBeHidden()

  await page.route(/\/orgs\/[^/]+\/notifications$/, async (route) => {
    await new Promise((done) => setTimeout(done, 3000))
    await route.continue()
  })
  await link.click()
  await expect(heading).toBeVisible({ timeout: 1000 })
  await expect(page.getByText('Laddar…')).toHaveCount(0)
})

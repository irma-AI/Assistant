import { expect, test } from '@playwright/test'

test('the home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Assistant')
})

// Locally the server runs as version e2e; after a deploy, APP_VERSION is the deployed commit.
test('/version serves the running version', async ({ request }) => {
  const response = await request.get('/version')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({
    version: process.env.APP_VERSION ?? 'e2e',
  })
})

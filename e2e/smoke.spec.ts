import { expect, test } from '@playwright/test'

test('the home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Assistant')
})

test('/version serves the running version', async ({ request }) => {
  const response = await request.get('/version')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({ version: 'e2e' })
})

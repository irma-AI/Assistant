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

// A Capacitor web view on Android calls the API cross-origin from https://localhost.
test('the API answers a cross-origin call from the app origin', async ({
  page,
  baseURL,
}) => {
  await page.route('https://localhost/', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>app</title>' }),
  )
  await page.goto('https://localhost/')
  const status = await page.evaluate(
    async (url) => (await fetch(url)).status,
    new URL('/api/v1/me', baseURL).href,
  )
  expect(status).toBe(401)
})

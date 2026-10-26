import { expect, test } from '@playwright/test'

test('the home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Redo')
})

// Locally the server runs as version e2e; after a deploy, APP_VERSION is the deployed commit.
test('/version serves the running version', async ({ request }) => {
  const response = await request.get('/version')
  expect(response.ok()).toBe(true)
  expect(await response.json()).toEqual({
    version: process.env.APP_VERSION ?? 'e2e',
    env: process.env.APP_ENV ?? null,
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

test('/app sends a logged-out visitor to the login screen', async ({
  page,
}) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/app\/login$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Logga in')
})

test('/ is server-rendered and /app is a client-only shell', async ({
  request,
}) => {
  expect(await (await request.get('/')).text()).toContain('<h1>Redo</h1>')
  expect(await (await request.get('/app')).text()).not.toContain('<h1>')
})

// Pages stay out of search engines everywhere but production (locally APP_ENV is unset).
test('/ is marked noindex only outside production', async ({ request }) => {
  const response = await request.get('/')
  const production = process.env.APP_ENV === 'production'
  expect(response.headers()['x-robots-tag']).toBe(
    production ? undefined : 'noindex',
  )
  const meta = '<meta name="robots" content="noindex">'
  if (production) expect(await response.text()).not.toContain(meta)
  else expect(await response.text()).toContain(meta)
})

test('an error thrown in the browser reaches /api/v1/client-errors', async ({
  page,
}) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const sent = page.waitForRequest('**/api/v1/client-errors')
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('boom')
    })
  })
  const body: unknown = (await sent).postDataJSON()
  expect(body).toMatchObject({ name: 'Error', message: 'boom' })
})

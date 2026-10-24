import { expect, test } from '@playwright/test'
import { z } from 'zod'

const fakeBankId = 'http://127.0.0.1:3101'
const sessionCookie = '__Host-session'

// The fake answers by the client's IP; the proxy's X-Forwarded-For header picks the outcome.
const returnUrlOf = (body: unknown) =>
  z.object({ returnUrl: z.string() }).parse(body)

const asIp = (ip: string) => ({ extraHTTPHeaders: { 'x-forwarded-for': ip } })

test('logs in by scanning the QR code on another device', async ({ page }) => {
  await page.goto('/app/login')
  await expect(
    page.getByText('Testmiljö – inloggningen är inte verifierad'),
  ).toBeVisible()
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page.getByAltText('QR-kod för BankID-inloggning')).toBeVisible()
  await page.getByRole('button', { name: 'Visa QR-koden i helskärm' }).click()
  await expect(
    page.getByRole('button', { name: 'Visa QR-koden mindre' }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  const cookies = await page.context().cookies()
  expect(cookies.map((c) => c.name)).toContain(sessionCookie)
})

// Each project gets its own IP, because the fake keeps one returnUrl per IP and the projects run in parallel.
test('logs in on the same device through the returnUrl', async ({
  page,
  request,
}, testInfo) => {
  const ip = `198.51.100.${String(10 + testInfo.workerIndex)}`
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip })
  await page.route('https://app.bankid.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>BankID</title>' }),
  )
  await page.goto('/app/login')
  await page.getByRole('button', { name: /den här enheten/ }).click()
  await page.waitForURL('https://app.bankid.com/**')
  const { returnUrl } = returnUrlOf(
    await (await request.get(`${fakeBankId}/last-return-url?ip=${ip}`)).json(),
  )
  await page.goto(returnUrl)
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  const cookies = await page.context().cookies()
  expect(cookies.map((c) => c.name)).toContain(sessionCookie)
})

test('cancelling returns to the start', async ({ page }) => {
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await page.getByRole('button', { name: 'Avbryt' }).click()
  await expect(page.getByRole('button', { name: /annan enhet/ })).toBeVisible()
})

test.describe('an expired order', () => {
  test.use(asIp('192.0.2.3'))
  test('offers to try again', async ({ page }) => {
    await page.goto('/app/login')
    await page.getByRole('button', { name: /annan enhet/ }).click()
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
    await expect(
      page.getByRole('button', { name: /annan enhet/ }),
    ).toBeVisible()
  })
})

test('a cross-site POST with the session cookie is rejected', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  const cookie = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
  const response = await request.post(
    `${baseURL ?? ''}/api/v1/auth/bankid/cancel`,
    {
      headers: { cookie, origin: 'https://evil.example' },
    },
  )
  expect(response.status()).toBe(403)
})

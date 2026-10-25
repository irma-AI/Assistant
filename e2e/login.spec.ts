import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { z } from 'zod'

// These specs need the in-process fake BankID, so they never run against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

const fakeBankId = 'http://127.0.0.1:3101'
const sessionCookie = '__Host-session'

// The fake answers by the client's IP; the proxy's X-Forwarded-For header picks the outcome.
const returnUrlOf = (body: unknown) =>
  z.object({ returnUrl: z.string() }).parse(body)

const asIp = (ip: string) => ({ extraHTTPHeaders: { 'x-forwarded-for': ip } })

const qrName = 'QR-kod, skanna på armlängds avstånd. Tryck för helskärm.'

test('logs in by scanning the QR code on another device', async ({ page }) => {
  await page.goto('/app/login')
  await expect(
    page.getByText('Testmiljö – inloggningen är inte verifierad'),
  ).toBeVisible()
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await page.getByRole('button', { name: qrName }).click()
  await expect(
    page.getByRole('button', {
      name: 'QR-kod, skanna på armlängds avstånd. Tryck för att lämna helskärm.',
    }),
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

test('creates an organisation after logging in and sees it listed', async ({
  page,
}) => {
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByLabel('Namn').fill('Bolaget AB')
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await expect(page.getByText('Bolaget AB (Ägare)')).toBeVisible()
  await expect(page.getByRole('note')).toBeVisible()
})

test('deletes the account after a fresh BankID confirmation', async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  // The fake gives one IP one person, so this IP's login and confirmation are the same account.
  const ip = `198.51.100.${String(100 + testInfo.workerIndex)}`
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  const cookie = (await page.context().cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
  const me = () =>
    request.get(`${baseURL ?? ''}/api/v1/me`, { headers: { cookie } })
  expect((await me()).status()).toBe(200)

  await page.getByRole('link', { name: 'Radera mitt konto' }).click()
  await expect(page.getByText(/bokföringslagen/)).toBeVisible()
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page.getByText('Ditt konto är raderat.')).toBeVisible({
    timeout: 15_000,
  })
  expect((await me()).status()).toBe(401)
  expect((await page.context().cookies()).map((c) => c.name)).not.toContain(
    sessionCookie,
  )
})

test('downloads the export as JSON', async ({ page }, testInfo) => {
  const ip = `198.51.100.${String(150 + testInfo.workerIndex)}`
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Ladda ner mina uppgifter' }).click()
  const path = await (await download).path()
  const body = z
    .object({
      account: z.object({ id: z.string() }),
      sessions: z.array(z.unknown()),
    })
    .parse(JSON.parse(readFileSync(path, 'utf8')))
  expect(body.sessions).toHaveLength(1)
})

// The status reply is held at 20 seconds left, so "Mer tid" shows without waiting five minutes.
test('offers more time near the end of the QR display, by button or space bar', async ({
  page,
}) => {
  let left = 20
  let extendCalls = 0
  await page.route('**/api/v1/auth/bankid/status', (route) =>
    route.fulfill({
      json: {
        status: 'pending',
        message: '',
        qr: 'bankid.x.0.y',
        remaining: left,
      },
    }),
  )
  page.on('request', (r) => {
    if (!r.url().endsWith('/api/v1/auth/bankid/extend')) return
    extendCalls += 1
    left = 300
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page.getByText('Tid kvar: 0:20')).toBeVisible()
  await page.getByRole('button', { name: 'Mer tid' }).click()
  await expect(page.getByText('Tid kvar: 5:00')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mer tid' })).toBeHidden()
  await expect(page.getByRole('button', { name: qrName })).toBeFocused()
  left = 20
  await expect(page.getByRole('button', { name: 'Mer tid' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByText('Tid kvar: 5:00')).toBeVisible()
  expect(extendCalls).toBe(2)
})

test('an admin invites a second user by link, who logs in and joins', async ({
  page,
  browser,
}, testInfo) => {
  // The fake gives one IP one person, so the invitee needs its own IP.
  const n = String(testInfo.workerIndex)
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(200 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByLabel('Namn').fill(`Inbjudan AB ${n}`)
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page.getByRole('button', { name: 'Skapa inbjudningslänk' }).click()
  const link = await page.getByLabel(/Länk/).inputValue()
  expect(link).toContain('/app/invite/')

  const guest = await browser.newContext({
    ...testInfo.project.use,
    extraHTTPHeaders: {
      'x-forwarded-for': `198.51.100.${String(220 + testInfo.workerIndex)}`,
    },
  })
  const second = await guest.newPage()
  await second.goto(link)
  await expect(
    second.getByRole('heading', { name: `Inbjudan till Inbjudan AB ${n}` }),
  ).toBeVisible()
  await second.getByRole('button', { name: /annan enhet/ }).click()
  await expect(second).toHaveURL(/\/app$/, { timeout: 15_000 })
  await expect(second.getByText(`Inbjudan AB ${n} (Medlem)`)).toBeVisible()

  // The link is single-use.
  await second.goto(link)
  await expect(second.getByRole('alert')).toBeVisible()
  await guest.close()
})

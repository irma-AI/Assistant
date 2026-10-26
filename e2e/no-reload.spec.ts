import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { z } from 'zod'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

const tab = (page: Page, name: string) =>
  page.getByRole('link', { name, exact: true })

const mark = (page: Page) =>
  page.evaluate(() => {
    Object.assign(window, { kept: true })
  })
const clientNav = (page: Page, path: string) =>
  page.evaluate((to) => {
    history.pushState({}, '', to)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
const kept = (page: Page) => page.evaluate(() => 'kept' in window)

test('the login return and in-app links never reload the document', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(180 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/konto')
  await expect(page).toHaveURL(/\/app\/login$/)
  await mark(page)
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app\/konto$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Inställningar' }).click()
  await expect(page).toHaveURL(/\/app\/installningar$/)
  await tab(page, 'Konto').click()
  await page.getByRole('link', { name: 'Radera mitt konto' }).click()
  await expect(page).toHaveURL(/\/app\/radera-konto$/)
  // An unknown address inside the app, reached without a reload.
  await page.evaluate(() => {
    history.pushState({}, '', '/app/finns-inte')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByRole('link', { name: 'Till startsidan' }).click()
  await expect(page).toHaveURL(/\/app$/)
  expect(await kept(page)).toBe(true)
})

test('the confirm-email link and the signed-out redirect never reload the document', async ({
  page,
}) => {
  await page.goto('/app/login')
  await mark(page)
  await clientNav(page, '/app/bekrafta-epost')
  await page.getByRole('link', { name: 'Till inställningar' }).click()
  // Signed out, so the shell sends the visit on to login.
  await expect(page).toHaveURL(/\/app\/login$/)
  expect(await kept(page)).toBe(true)
})

test('the login return screen never reloads the document', async ({
  page,
  request,
}, testInfo) => {
  const ip = `198.51.100.${String(200 + testInfo.workerIndex)}`
  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': ip })
  await page.goto('/app/login/return')
  await mark(page)
  await page.getByRole('link', { name: 'Försök igen' }).click()
  await expect(page).toHaveURL(/\/app\/login$/)
  expect(await kept(page)).toBe(true)

  await page.route('https://app.bankid.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>BankID</title>' }),
  )
  await page.getByRole('button', { name: /den här enheten/ }).click()
  await page.waitForURL('https://app.bankid.com/**')
  const { returnUrl } = z
    .object({ returnUrl: z.string() })
    .parse(
      await (
        await request.get(`http://127.0.0.1:3101/last-return-url?ip=${ip}`)
      ).json(),
    )
  await page.goto(returnUrl)
  await mark(page)
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  expect(await kept(page)).toBe(true)
})

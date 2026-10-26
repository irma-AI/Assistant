import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Needs the in-process fake BankID, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

const tab = (page: Page, name: string) =>
  page.getByRole('link', { name, exact: true })

// A logged-out visit to `path` ends at the login screen; logging in lands back on `path`.
async function loginTo(page: Page, path: string, workerIndex: number) {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(170 + workerIndex)}`,
  })
  await page.goto(path)
  await expect(page).toHaveURL(/\/app\/login$/)
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 15_000 })
}

test('a logged-out visit to a tab logs in and lands on that tab', async ({
  page,
}, testInfo) => {
  await loginTo(page, '/app/organisation', testInfo.workerIndex)
  await expect(tab(page, 'Organisation')).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('the tab bar opens each screen and marks the open one', async ({
  page,
}, testInfo) => {
  await loginTo(page, '/app', testInfo.workerIndex)
  const screens = [
    ['Hem', undefined],
    ['Organisation', 'Organisation'],
    ['Konto', 'Konto'],
  ] as const
  for (const [name, heading] of screens) {
    await tab(page, name).click()
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    for (const [other] of screens)
      if (other === name)
        await expect(tab(page, other)).toHaveAttribute('aria-current', 'page')
      else await expect(tab(page, other)).not.toHaveAttribute('aria-current')
  }
})

test('a created organisation is listed, and choosing it shows it on Hem', async ({
  page,
}, testInfo) => {
  await loginTo(page, '/app', testInfo.workerIndex)
  await tab(page, 'Organisation').click()
  const run = String(Date.now())
  for (const name of [`Första AB ${run}`, `Andra AB ${run}`]) {
    await page.getByLabel('Namn').fill(name)
    await page.getByRole('button', { name: 'Skapa organisation' }).click()
    await expect(page.getByText(name, { exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: `Första AB ${run}` }).click()
  await tab(page, 'Hem').click()
  await expect(
    page.getByRole('heading', { level: 1, name: `Första AB ${run}` }),
  ).toBeVisible()
})

test('Logga ut ends the session and returns to login', async ({
  page,
}, testInfo) => {
  await loginTo(page, '/app/konto', testInfo.workerIndex)
  await page.getByRole('button', { name: 'Logga ut' }).click()
  await expect(page).toHaveURL(/\/app\/login$/)
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})

test('fonts load from the app, never from Google', async ({
  page,
}, testInfo) => {
  const run = String(Date.now())
  const requested: string[] = []
  page.on('request', (request) => requested.push(request.url()))
  await loginTo(page, '/app', testInfo.workerIndex)
  await tab(page, 'Organisation').click()
  await page.getByLabel('Namn').fill(`Fontbolaget ${run}`)
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page.getByRole('button', { name: `Fontbolaget ${run}` }).click()
  await tab(page, 'Hem').click()
  await expect(
    page.getByRole('heading', { level: 1, name: `Fontbolaget ${run}` }),
  ).toBeVisible()
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replaceAll('"', ''))
  })
  expect(loaded).toEqual(
    expect.arrayContaining(['Newsreader', 'Schibsted Grotesk']),
  )
  expect(
    requested.filter((url) => /fonts\.g(oogleapis|static)\.com/.test(url)),
  ).toEqual([])
  const fontFiles = requested.filter((url) => url.endsWith('.woff2'))
  expect(fontFiles.length).toBeGreaterThan(0)
  const origin = new URL(page.url()).origin
  for (const url of fontFiles) expect(url.startsWith(origin)).toBe(true)
})

const themes = {
  dark: {
    ground: 'rgb(11, 19, 34)',
    panel: 'rgba(255, 255, 255, 0.04)',
    edge: 'rgb(42, 52, 71)',
    text: 'rgb(255, 255, 255)',
  },
  light: {
    ground: 'rgb(233, 237, 242)',
    panel: 'rgb(255, 255, 255)',
    edge: 'rgb(211, 217, 225)',
    text: 'rgb(11, 19, 34)',
  },
} as const

for (const scheme of ['dark', 'light'] as const) {
  test(`Hem uses the ${scheme} colours of DESIGN.md`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ colorScheme: scheme })
    await loginTo(page, '/app', testInfo.workerIndex)
    const colours = await page.evaluate(() => {
      const panel = document.body.appendChild(document.createElement('div'))
      panel.className = 'panel'
      const own = getComputedStyle(panel)
      return {
        ground: getComputedStyle(document.body).backgroundColor,
        panel: own.backgroundColor,
        edge: own.borderTopColor,
        text: getComputedStyle(document.body).color,
      }
    })
    expect(colours).toEqual(themes[scheme])
  })
}

test('at double text size no tab scrolls sideways and tab labels keep their size', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginTo(page, '/app', testInfo.workerIndex)
  const labelSize = () =>
    tab(page, 'Hem').evaluate((el) => getComputedStyle(el).fontSize)
  const before = await labelSize()
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '34px'
  })
  expect(await labelSize()).toBe(before)
  for (const name of ['Hem', 'Organisation', 'Konto']) {
    await tab(page, name).click()
    await expect(tab(page, name)).toHaveAttribute('aria-current', 'page')
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true)
  }
})

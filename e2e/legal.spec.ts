import { expect, test } from '@playwright/test'

const pages = [
  ['/integritetspolicy', 'Integritetspolicy'],
  ['/villkor', 'Villkor'],
  ['/personuppgiftsbitradesavtal', 'Personuppgiftsbiträdesavtal'],
] as const

for (const [path, title] of pages) {
  test(`${path} is server-rendered`, async ({ page, request }) => {
    expect(await (await request.get(path)).text()).toContain(
      `<h1>${title}</h1>`,
    )
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
  })

  test(`the home page links to ${path}`, async ({ page }) => {
    await page.goto('/')
    await page.locator(`footer a[href="${path}"]`).click()
    await expect(page).toHaveURL(path)
  })
}

test('the login screen links to the privacy policy', async ({ page }) => {
  await page.goto('/app/login')
  await page.getByRole('link', { name: 'Integritetspolicy' }).click()
  await expect(page).toHaveURL('/integritetspolicy')
})

test('the home page names Redo and links to login', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Redo')
  await expect(page.getByRole('link', { name: 'Logga in' })).toHaveAttribute(
    'href',
    '/app/login',
  )
})

for (const path of [
  '/',
  '/integritetspolicy',
  '/villkor',
  '/personuppgiftsbitradesavtal',
]) {
  test(`${path} does not scroll sideways at double text size`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await page.addStyleTag({ content: 'html { font-size: 212.5% !important }' })
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
}

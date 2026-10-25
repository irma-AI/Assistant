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

import { expect, test } from '@playwright/test'

// The look of the screens outside the shell; they need the in-process fake BankID.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

const qrName = 'QR-kod, skanna på armlängds avstånd. Tryck för helskärm.'

test('the likely BankID path is the Cable light pill, and the other is secondary', async ({
  page,
}) => {
  await page.goto('/app/login')
  const same = page.getByRole('button', { name: /den här enheten/ })
  const other = page.getByRole('button', { name: /annan enhet/ })
  await expect(same).not.toHaveClass(/secondary/)
  await expect(other).toHaveClass(/secondary/)
})

test.describe('on a wide screen', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15',
    hasTouch: false,
    isMobile: false,
  })
  test('the other-device choice is the pill', async ({ page }) => {
    await page.goto('/app/login')
    await expect(
      page.getByRole('button', { name: /annan enhet/ }),
    ).not.toHaveClass(/secondary/)
    await expect(
      page.getByRole('button', { name: /den här enheten/ }),
    ).toHaveClass(/secondary/)
  })
})

test('the QR code sits on white and the four screens do not scroll sideways at double text', async ({
  page,
}) => {
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  const qr = page.getByRole('button', { name: qrName })
  await expect(qr).toBeVisible()
  await expect(qr).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await qr.click()
  for (const path of [
    '/app/login',
    '/app/login/return',
    '/app/login/demo',
    '/app/radera-konto',
  ]) {
    await page.goto(path)
    await page.addStyleTag({ content: 'html { font-size: 212.5% !important }' })
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
    expect(wide, path).toBe(false)
  }
})

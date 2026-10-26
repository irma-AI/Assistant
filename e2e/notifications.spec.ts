import { expect, test } from '@playwright/test'
import pg from 'pg'
import { mailsTo } from './mail'

// Needs the in-process fake BankID, the local mail server and the database, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

test('a user confirms an email address in settings, then reads a notice and marks it read', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(240 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByLabel('Namn').fill('Aviserings AB')
  await page.getByRole('button', { name: 'Skapa organisation' }).click()

  const address = `ana-${testInfo.project.name}-${String(Date.now())}@example.test`
  await page.getByRole('link', { name: 'Inställningar' }).click()
  await page.getByLabel('E-postadress').fill(address)
  await page.getByRole('button', { name: 'Skicka bekräftelselänk' }).click()
  await expect(page.getByText('(inte bekräftad ännu)')).toBeVisible()

  await expect.poll(() => mailsTo(address).length).toBe(1)
  const link = /https:\/\/\S+#\S+/.exec(mailsTo(address)[0] ?? '')?.[0] ?? ''
  await page.goto(link)
  await expect(page.getByText('Adressen är bekräftad')).toBeVisible()
  await page.getByRole('link', { name: 'Till inställningar' }).click()
  await expect(page.getByText('(bekräftad)')).toBeVisible()

  // No feature creates events yet, so the test records one as a feature would.
  await page.goto('/app')
  const href = await page
    .getByRole('link', { name: 'Aviseringar' })
    .getAttribute('href')
  const orgId = /org\/([^/]+)\//.exec(href ?? '')?.[1]
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(
    `insert into notification_events (organisation_id, type, payload) values ($1, 'member_joined', '{"name":"Kim Test"}')`,
    [orgId],
  )
  await client.end()

  await page.getByRole('link', { name: 'Aviseringar' }).click()
  const notice = page
    .getByRole('listitem')
    .filter({ hasText: 'Kim Test har gått med' })
  await expect(notice.getByText('(oläst)')).toBeVisible()
  await notice.getByRole('button', { name: 'Markera som läst' }).click()
  await expect(notice.getByText('(läst)')).toBeVisible()
})

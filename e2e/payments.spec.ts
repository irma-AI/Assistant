import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { z } from 'zod'

// Needs the in-process fake BankID and the database, so it never runs against a deployed URL.
test.skip(!!process.env.PLAYWRIGHT_BASE_URL, 'needs the local fake BankID')

// A valid organisation number that no earlier run used: nine digits from the clock and a Luhn check digit.
function orgNumber() {
  const base = String(Date.now() % 1_000_000_000).padStart(9, '5')
  let sum = 0
  for (let i = 0; i < base.length; i++) {
    const d = Number(base.charAt(i)) * (i % 2 === 0 ? 2 : 1)
    sum += d > 9 ? d - 9 : d
  }
  return `${base}${String((10 - (sum % 10)) % 10)}`
}

const company = () => ({
  org_number: orgNumber(),
  legal_name: 'Faktura AB',
  company_form: 'ab',
  seat: 'Stockholm',
  street: 'Storgatan 1',
  postal_code: '11122',
  city: 'Stockholm',
  f_skatt: true,
  vat_period: 'quarterly',
  accounting_method: 'invoice',
  payment_kind: 'bankgiro',
  payment_number: '123-4567',
  swish: null,
  contact_email: 'info@example.com',
  contact_phone: null,
  fiscal_year_start: '2026-01-01',
  fiscal_year_end: '2026-12-31',
})

const statement = [
  'Kontohändelser',
  'Konto;Exempelkonto',
  '',
  'Reskontradatum;Transaktionsdatum;Text;Belopp;Saldo',
  '2026-03-20;2026-03-20;Grannen AB;12 500,00;12 500,00',
].join('\n')

// No invoice or bank screens yet: the invoice is sent and the statement imported through the API.
async function sendInvoiceAndImportPayment(page: Page, orgId: string) {
  const origin = new URL(page.url()).origin
  const post = async (path: string, data: unknown, method = 'post') => {
    const response = await page.request.fetch(`/api/v1/orgs/${orgId}/${path}`, {
      method,
      data,
      headers: { origin },
    })
    expect(response.ok()).toBe(true)
    return (
      z
        .object({ id: z.string().optional() })
        .parse(await response.json().catch(() => ({}))).id ?? ''
    )
  }
  await post('bookkeeping/fiscal-years', {
    starts_on: '2026-01-01',
    ends_on: '2026-12-31',
  })
  await post('company', company(), 'put')
  const customer = await post('customers', {
    kind: 'business',
    name: 'Grannen AB',
    address: 'Vägen 2\n111 22 Stockholm',
    email: 'kund@example.com',
    org_number: '5560160680',
  })
  const invoice = await post('invoices', {
    customer_id: customer,
    invoice_date: '2026-03-10',
    lines: [
      {
        description: 'Konsulttimmar',
        quantity: 10,
        unit: 'tim',
        unit_price: 100000,
        vat_code: '25',
      },
    ],
  })
  await post(`invoices/${invoice}/send`, { delivery: 'download' })
  const account = await post('bank-accounts', { title: 'Företagskonto' })
  const imported = await page.request.post(
    `/api/v1/orgs/${orgId}/bank-accounts/${account}/imports?name=bank.csv`,
    { data: statement, headers: { origin } },
  )
  expect(imported.ok()).toBe(true)
}

test('an Ägare sees the payment suggested for a sent invoice and confirms it with one tap', async ({
  page,
}, testInfo) => {
  await page.context().setExtraHTTPHeaders({
    'x-forwarded-for': `198.51.100.${String(210 + testInfo.workerIndex)}`,
  })
  await page.goto('/app/login')
  await page.getByRole('button', { name: /annan enhet/ }).click()
  await expect(page).toHaveURL(/\/app$/, { timeout: 15_000 })
  await page.getByRole('link', { name: 'Organisation', exact: true }).click()
  await page.getByLabel('Namn').fill('Faktura AB')
  await page.getByRole('button', { name: 'Skapa organisation' }).click()
  await page.getByRole('link', { name: 'Fakturor' }).click()
  await expect(page.getByText('Inga skickade fakturor ännu.')).toBeVisible()
  await sendInvoiceAndImportPayment(
    page,
    /org\/([^/]+)\//.exec(page.url())?.[1] ?? '',
  )

  await page.reload()
  await expect(page.getByText(/Förslag: 2026-03-20 Grannen AB/)).toBeVisible()
  await expect(
    page.getByText(/Samma belopp inom betalningstiden, 85 % säker/),
  ).toBeVisible()
  await page
    .getByRole('button', { name: /Godkänn betalningen för faktura 1/ })
    .click()
  await expect(page.getByText(/^Betald, /)).toBeVisible()
})

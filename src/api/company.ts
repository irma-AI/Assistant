import { z } from 'zod'

// Luhn over the 10 digits of an organisation number.
export const luhn = (digits: string) =>
  digits
    .split('')
    .reverse()
    .reduce((sum, c, i) => {
      const n = Number(c) * (i % 2 ? 2 : 1)
      return sum + (n > 9 ? n - 9 : n)
    }, 0) %
    10 ===
  0

// SE + the 10 digits + 01; never typed separately.
export const vatNumber = (orgNumber: string) => `SE${orgNumber}01`

const orgNumber = z
  .string()
  .trim()
  .transform((s) => s.replace(/^(\d{6})-(\d{4})$/, '$1$2'))
  .pipe(
    z
      .string()
      .regex(/^\d{10}$/)
      .refine(luhn),
  )

const text = z.string().trim().min(1).max(100)
const day = z.iso.date()

// BFL 3 kap. 1–3 §: a fiscal year is 12 months, a first or changed one may be shorter or up to 18 months.
export function fiscalYearOk(start: string, end: string) {
  const s = new Date(start)
  const limit = new Date(
    Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 18, s.getUTCDate()),
  )
  return end > start && new Date(end) < limit
}

export const companyInput = z
  .object({
    org_number: orgNumber,
    legal_name: text,
    company_form: z.enum(['ab']),
    seat: text,
    street: text,
    postal_code: z.string().regex(/^\d{5}$/),
    city: text,
    f_skatt: z.boolean(),
    vat_period: z.enum(['yearly', 'quarterly', 'monthly']),
    accounting_method: z.enum(['invoice', 'cash']),
    payment_kind: z.enum(['bankgiro', 'plusgiro', 'iban']),
    payment_number: z.string().trim().min(1).max(34),
    swish: z.string().trim().min(1).max(20).nullable(),
    contact_email: z.email().max(254).nullable(),
    contact_phone: z.string().trim().min(3).max(30).nullable(),
    fiscal_year_start: day,
    fiscal_year_end: day,
  })
  .refine((c) => fiscalYearOk(c.fiscal_year_start, c.fiscal_year_end), {
    path: ['fiscal_year_end'],
  })

export const company = companyInput
  .and(z.object({ vat_number: z.string() }))
  .nullable()

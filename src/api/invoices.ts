import { z } from 'zod'

const day = z.iso.date()

// Until the VAT codes of IRM-163 exist: the Swedish rates, and reverse charge.
export const vatCode = z.enum(['25', '12', '6', '0', 'rc'])

const line = z.object({
  description: z.string().trim().min(1).max(500),
  // Up to three decimals; the database keeps thousandths.
  quantity: z
    .number()
    .positive()
    .max(100_000)
    .refine((q) => Math.abs(q * 1000 - Math.round(q * 1000)) < 1e-6),
  unit: z.string().trim().min(1).max(10).default('st'),
  // Whole öre, like the voucher lines.
  unit_price: z.number().int().min(0).max(100_000_000_000),
  vat_code: vatCode,
})

// customer_id is required for an invoice and ignored for a credit note, which keeps the original's buyer.
export const invoiceInput = z
  .object({
    customer_id: z.uuid().nullish(),
    invoice_date: day,
    supply_date: day.optional(),
    due_date: day.optional(),
    reference: z.string().trim().min(1).max(100).nullish(),
    lines: z.array(line).min(1).max(100),
  })
  .refine((i) => !i.due_date || i.due_date >= i.invoice_date)

export const sendInput = z.object({ delivery: z.enum(['email', 'download']) })

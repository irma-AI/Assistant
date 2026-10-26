import { z } from 'zod'
import { fiscalYearOk } from './company'

// Whole öre; the database caps a line below 10^15.
const ore = z.number().int().min(0).max(999_999_999_999_999)
const day = z.iso.date()

export const newFiscalYear = z
  .object({ starts_on: day, ends_on: day })
  .refine((y) => fiscalYearOk(y.starts_on, y.ends_on))

export const lockInput = z.object({ locked_through: day })

export const newAccount = z.object({
  number: z.string().regex(/^[1-8]\d{3}$/),
  name: z.string().trim().min(1).max(200),
})

export const accountEdit = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    active: z.boolean().optional(),
  })
  .refine((a) => a.name !== undefined || a.active !== undefined)

const line = z
  .object({
    account: z.string().regex(/^[1-8]\d{3}$/),
    debit: ore,
    credit: ore,
    text: z.string().trim().min(1).max(200).nullish(),
  })
  // Exactly one side carries the amount.
  .refine((l) => l.debit > 0 !== l.credit > 0)

export const voucherInput = z.object({
  voucher_date: day,
  description: z.string().trim().min(1).max(500),
  lines: z.array(line).min(1).max(200),
})

export const reverseInput = z.object({ voucher_date: day.optional() })

export const attachInput = z.object({ document_id: z.uuid() })

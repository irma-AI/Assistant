import { z } from 'zod'

export const errorBody = z.object({ error: z.string() })

export const me = z.object({ id: z.string() })

export const sessions = z.array(
  z.object({
    id: z.string(),
    kind: z.string(),
    startedAt: z.string(),
    lastUsedAt: z.string(),
    current: z.boolean(),
  }),
)

export const permission = z.enum([
  'organisation.manage',
  'members.manage',
  'roles.manage',
  'customers.manage',
  'documents.manage',
  'bank.manage',
  'bookkeeping.manage',
])

export const newOrganisation = z.object({
  name: z.string().trim().min(1).max(100),
})
export const newRole = z.object({
  name: z.string().trim().min(1).max(50),
  permissions: z.array(permission),
})
export const roleEdit = newRole.partial()
export const newBankAccount = z.object({
  title: z.string().trim().min(1).max(100),
})
export const newInvite = z.object({ roleId: z.uuid() })
export const roleChange = z.object({ roleId: z.uuid() })

export const organisations = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    owners: z.number(),
  }),
)

export const invite = z.object({
  id: z.string(),
  role: z.string(),
  expires_at: z.string(),
})
export const invites = z.array(invite)
export const createdInvite = z.object({ id: z.string(), token: z.string() })
export const invitePreview = z.object({ organisation: z.string() })

export const roleList = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    kind: z.string(),
    permissions: z.array(z.string()),
  }),
)
export const memberList = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    role_id: z.string(),
    role: z.string(),
  }),
)

const blank = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && !v.trim() ? null : v),
    schema.nullish().transform((v) => v ?? null),
  )
const orgNumber = z
  .string()
  .trim()
  .regex(/^\d{6}-?\d{4}$/)
  .transform((s) => s.replace(/^(\d{6})-?/, '$1-'))
const vatNumber = z
  .string()
  .trim()
  .transform((s) => s.replaceAll(' ', '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}[A-Z0-9]{2,12}$/))

// A consumer carries no business fields. A business gets 30 days when none is given (Räntelagen 4 §).
export const newCustomer = z
  .object({
    kind: z.enum(['business', 'consumer']),
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().min(1).max(500),
    email: blank(z.email().max(254)),
    language: z.enum(['sv', 'en']).default('sv'),
    org_number: blank(orgNumber),
    vat_number: blank(vatNumber),
    contact: blank(z.string().trim().max(200)),
    payment_terms_days: blank(z.number().int().min(0).max(365)),
  })
  .refine(
    (c) =>
      c.kind === 'business' ||
      (!c.org_number &&
        !c.vat_number &&
        !c.contact &&
        c.payment_terms_days === null),
  )
  .transform((c) => ({
    ...c,
    payment_terms_days:
      c.kind === 'business' ? (c.payment_terms_days ?? 30) : null,
  }))

export const customerList = z.array(
  z.object({
    id: z.string(),
    kind: z.enum(['business', 'consumer']),
    name: z.string(),
    address: z.string(),
    email: z.string().nullable(),
    language: z.enum(['sv', 'en']),
    org_number: z.string().nullable(),
    vat_number: z.string().nullable(),
    contact: z.string().nullable(),
    payment_terms_days: z.number().nullable(),
  }),
)

// `mapping` names the CSV column for each customer field; `commit` saves, otherwise it only checks.
export const customerImport = z.object({
  csv: z.string().max(1_000_000),
  mapping: z.record(z.string(), z.string()),
  commit: z.boolean(),
})
export const importResult = z.object({
  rows: z.number(),
  errors: z.array(z.object({ row: z.number(), fields: z.array(z.string()) })),
  saved: z.boolean(),
})

export const notices = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    created_at: z.string(),
    read: z.boolean(),
  }),
)
export const noticePreferences = z.array(
  z.object({
    type: z.string(),
    label: z.string(),
    mandatory: z.boolean(),
    email: z.boolean(),
  }),
)
export const preferenceChange = z.object({ email: z.boolean() })
export const emailAddress = z.object({
  email: z.string().nullable(),
  verified: z.boolean(),
})
export const newEmail = z.object({
  email: z.string().trim().max(254).pipe(z.email()),
})
export const emailToken = z.object({ token: z.string().max(100) })

const text = (max: number) => z.string().trim().min(1).max(max).nullable()
export const receiptFields = z
  .strictObject({
    supplier: text(200),
    amount_ore: z.number().int().positive().max(999_999_999_999_999).nullable(),
    receipt_date: z.iso.date().nullable(),
    reference: text(50),
    giro: text(20),
  })
  .partial()
export const receiptLink = z.object({
  transactionId: z.uuid(),
  coversOre: z.number().int().positive().optional(),
})
export const receiptVerdict = z.object({
  verdict: z.enum(['confirmed', 'rejected']),
})
export const receiptSettings = z.object({ suggestions: z.boolean() })

export const receiptMatch = z.object({
  id: z.string(),
  status: z.enum(['suggested', 'confirmed']),
  confidence: z.number().nullable(),
  reason: z.string().nullable(),
  covers_ore: z.number(),
  transaction: z.object({
    id: z.string(),
    amount_ore: z.number(),
    booking_date: z.string(),
    counterparty: z.string().nullable(),
  }),
})
export const receiptList = z.array(
  z.object({
    id: z.string(),
    document_id: z.string(),
    name: z.string(),
    supplier: z.string().nullable(),
    amount_ore: z.number().nullable(),
    receipt_date: z.string().nullable(),
    reference: z.string().nullable(),
    giro: z.string().nullable(),
    source: z.string(),
    mail_context: z.string().nullable(),
    matches: z.array(receiptMatch),
    suggested_account: z
      .object({ number: z.string(), name: z.string() })
      .nullable(),
  }),
)
export const unmatchedList = z.array(
  z.object({
    id: z.string(),
    amount_ore: z.number(),
    booking_date: z.string(),
    counterparty: z.string().nullable(),
  }),
)
export const receiptSettingsView = z.object({
  suggestions: z.boolean(),
  inbox: z.string().nullable(),
})

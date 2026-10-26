// The four match passes for an incoming payment against an open invoice (IRM-149 decision 3, the passes of IRM-147).
// Pure: an invoice and a bank transaction in, the best pass out. Amounts are öre; money in is positive.
export type InvoiceFacts = {
  number: number
  ocr: string
  open_ore: number
  invoice_date: string
  due_date: string
  buyer: string
}
export type PaymentFacts = {
  amount_ore: number
  booking_date: string
  counterparty: string | null
  reference: string | null
}
export type PaymentMatch = {
  pass: 1 | 2 | 3 | 4
  confidence: number
  reason: string
}

const graceDays = 30
const toleranceOre = 500
const day = 86_400_000

// Leading zeros are padding in a reference, never part of it.
const digits = (s: string | null) =>
  (s ?? '').replace(/\D/g, '').replace(/^0+/, '')
const letters = (s: string | null) =>
  (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const days = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / day

const byOcr = (i: InvoiceFacts, t: PaymentFacts): PaymentMatch | undefined =>
  digits(i.ocr).length >= 3 && digits(t.reference) === digits(i.ocr)
    ? { pass: 1, confidence: 0.98, reason: 'Samma OCR-nummer' }
    : undefined

const text = (t: PaymentFacts) => `${t.counterparty ?? ''} ${t.reference ?? ''}`

const byNumber = (
  i: InvoiceFacts,
  t: PaymentFacts,
): PaymentMatch | undefined =>
  t.amount_ore === i.open_ore &&
  new RegExp(`(^|\\D)0*${String(i.number)}(\\D|$)`).test(text(t))
    ? {
        pass: 2,
        confidence: 0.92,
        reason: 'Samma belopp och fakturanumret i texten',
      }
    : undefined

const inCreditPeriod = (
  i: InvoiceFacts,
  t: PaymentFacts,
): PaymentMatch | undefined => {
  const since = days(i.invoice_date, t.booking_date)
  return t.amount_ore === i.open_ore &&
    since >= 0 &&
    since <= days(i.invoice_date, i.due_date) + graceDays
    ? {
        pass: 3,
        confidence: 0.85,
        reason: 'Samma belopp inom betalningstiden',
      }
    : undefined
}

// A name under three letters would sit inside almost any bank text.
const byName = (i: InvoiceFacts, t: PaymentFacts): PaymentMatch | undefined => {
  const name = letters(i.buyer)
  return Math.abs(t.amount_ore - i.open_ore) <= toleranceOre &&
    name.length >= 3 &&
    letters(text(t)).includes(name)
    ? {
        pass: 4,
        confidence: 0.7,
        reason: 'Belopp inom 5 kr och kunden i banktexten',
      }
    : undefined
}

export function matchPayment(
  i: InvoiceFacts,
  t: PaymentFacts,
): PaymentMatch | undefined {
  if (t.amount_ore <= 0 || i.open_ore <= 0) return undefined
  return byOcr(i, t) ?? byNumber(i, t) ?? inCreditPeriod(i, t) ?? byName(i, t)
}

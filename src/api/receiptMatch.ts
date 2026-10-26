// The four match passes (IRM-147 decision 4). Pure: a receipt and a bank transaction in, the best pass out.
// Amounts are öre; a payment is a negative transaction amount.
export type ReceiptFacts = {
  supplier: string | null
  amount_ore: number
  receipt_date: string | null
  reference: string | null
  giro: string | null
}
export type TransactionFacts = {
  amount_ore: number
  booking_date: string
  counterparty: string | null
  reference: string | null
}
export type Match = { pass: 1 | 2 | 3 | 4; confidence: number; reason: string }

const creditDays = 30
const toleranceOre = 500
const day = 86_400_000

const digits = (s: string | null) => (s ?? '').replace(/\D/g, '')
const letters = (s: string | null) =>
  (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const days = (from: string, to: string) =>
  (Date.parse(to) - Date.parse(from)) / day

const reference = (r: ReceiptFacts, t: TransactionFacts): Match | undefined => {
  const ref = digits(r.reference)
  if (ref.length >= 4 && digits(t.reference) === ref)
    return { pass: 1, confidence: 0.98, reason: 'Samma referensnummer' }
}

const giro = (r: ReceiptFacts, t: TransactionFacts): Match | undefined => {
  const g = digits(r.giro)
  const text = digits(`${t.counterparty ?? ''} ${t.reference ?? ''}`)
  if (-t.amount_ore === r.amount_ore && g.length >= 6 && text.includes(g))
    return { pass: 2, confidence: 0.92, reason: 'Samma belopp och giro' }
}

const creditPeriod = (
  r: ReceiptFacts,
  t: TransactionFacts,
): Match | undefined => {
  const since = r.receipt_date ? days(r.receipt_date, t.booking_date) : NaN
  if (-t.amount_ore === r.amount_ore && since >= 0 && since <= creditDays)
    return {
      pass: 3,
      confidence: 0.85,
      reason: 'Samma belopp inom betalningstiden',
    }
}

const nameInText = (
  r: ReceiptFacts,
  t: TransactionFacts,
  aliases: string[],
): Match | undefined => {
  const text = letters(`${t.counterparty ?? ''} ${t.reference ?? ''}`)
  const names = [r.supplier ?? '', ...aliases].map(letters).filter(Boolean)
  if (
    Math.abs(-t.amount_ore - r.amount_ore) <= toleranceOre &&
    names.some((n) => text.includes(n))
  )
    return {
      pass: 4,
      confidence: 0.7,
      reason: 'Belopp inom 5 kr och leverantören i banktexten',
    }
}

// aliases: bank texts a person earlier matched to this supplier.
export function matchPass(
  r: ReceiptFacts,
  t: TransactionFacts,
  aliases: string[] = [],
): Match | undefined {
  if (t.amount_ore >= 0) return undefined
  return (
    reference(r, t) ??
    giro(r, t) ??
    creditPeriod(r, t) ??
    nameInText(r, t, aliases)
  )
}

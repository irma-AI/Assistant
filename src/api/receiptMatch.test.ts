import { expect, test } from 'vitest'
import { matchPass } from './receiptMatch'
import type { ReceiptFacts, TransactionFacts } from './receiptMatch'

// All made up.
const receipt: ReceiptFacts = {
  supplier: 'Exempelkafé AB',
  amount_ore: 12500,
  receipt_date: '2026-03-01',
  reference: null,
  giro: null,
}
const tx: TransactionFacts = {
  amount_ore: -12500,
  booking_date: '2026-03-10',
  counterparty: 'Okänd',
  reference: null,
}

test('pass 1: the same reference', () => {
  expect(
    matchPass(
      { ...receipt, reference: '1234 5678' },
      { ...tx, amount_ore: -1, reference: '12345678' },
    ),
  ).toMatchObject({ pass: 1, confidence: 0.98 })
})

test('pass 2: the same amount and the giro in the bank text', () => {
  expect(
    matchPass(
      { ...receipt, giro: '123-4567' },
      { ...tx, counterparty: 'BG 123-4567 Okänd' },
    ),
  ).toMatchObject({ pass: 2, confidence: 0.92 })
})

test('pass 3: the same amount within the credit period, not before the receipt or after it', () => {
  expect(matchPass(receipt, tx)).toMatchObject({ pass: 3, confidence: 0.85 })
  expect(
    matchPass(receipt, { ...tx, booking_date: '2026-02-28' }),
  ).toBeUndefined()
  expect(
    matchPass(receipt, { ...tx, booking_date: '2026-04-05' }),
  ).toBeUndefined()
})

test('pass 4: within 5 kr and the supplier in the bank text, also through a remembered alias', () => {
  const late = { ...tx, booking_date: '2026-06-01', amount_ore: -12900 }
  expect(
    matchPass(receipt, { ...late, counterparty: 'EXEMPELKAFÉ AB Stockholm' }),
  ).toMatchObject({ pass: 4, confidence: 0.7 })
  expect(matchPass(receipt, late)).toBeUndefined()
  expect(matchPass(receipt, late, ['okänd'])).toMatchObject({ pass: 4 })
  expect(
    matchPass(receipt, {
      ...late,
      amount_ore: -13100,
      counterparty: 'Exempelkafé',
    }),
  ).toBeUndefined()
})

test('money in is never a receipt match', () => {
  expect(matchPass(receipt, { ...tx, amount_ore: 12500 })).toBeUndefined()
})

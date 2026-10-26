import { expect, test } from 'vitest'
import { matchPayment } from './paymentMatch'

const invoice = {
  number: 1042,
  ocr: '104263',
  open_ore: 125_000,
  invoice_date: '2026-03-10',
  due_date: '2026-04-09',
  buyer: 'Grannen AB',
}
const pay = (o: object) => ({
  amount_ore: 125_000,
  booking_date: '2026-03-20',
  counterparty: null,
  reference: null,
  ...o,
})

test('each pass gives its confidence, the strongest first', () => {
  expect(matchPayment(invoice, pay({ reference: '0104263' }))).toMatchObject({
    pass: 1,
    confidence: 0.98,
  })
  // The OCR counts whatever the amount, so a part payment is found.
  expect(
    matchPayment(invoice, pay({ reference: '104263', amount_ore: 50_000 })),
  ).toMatchObject({ pass: 1 })
  expect(
    matchPayment(invoice, pay({ reference: 'Faktura 1042' })),
  ).toMatchObject({ pass: 2, confidence: 0.92 })
  expect(matchPayment(invoice, pay({}))).toMatchObject({
    pass: 3,
    confidence: 0.85,
  })
  expect(
    matchPayment(
      invoice,
      pay({ amount_ore: 124_800, counterparty: 'GRANNEN AB' }),
    ),
  ).toMatchObject({ pass: 4, confidence: 0.7 })
})

test('below 0.70 there is nothing to suggest', () => {
  // Late beyond the credit period, wrong amount, a name that is too short, money out, a number inside another.
  expect(
    matchPayment(invoice, pay({ booking_date: '2026-06-01' })),
  ).toBeUndefined()
  expect(
    matchPayment(
      invoice,
      pay({ amount_ore: 100_000, counterparty: 'Grannen AB' }),
    ),
  ).toBeUndefined()
  expect(
    matchPayment(
      { ...invoice, buyer: 'AB' },
      pay({ amount_ore: 124_800, counterparty: 'AB' }),
    ),
  ).toBeUndefined()
  expect(matchPayment(invoice, pay({ amount_ore: -125_000 }))).toBeUndefined()
  expect(
    matchPayment(
      invoice,
      pay({ booking_date: '2026-06-01', reference: 'Faktura 21042' }),
    ),
  ).toBeUndefined()
  expect(matchPayment({ ...invoice, open_ore: 0 }, pay({}))).toBeUndefined()
})

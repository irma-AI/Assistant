import { afterEach, expect, test, vi } from 'vitest'
import { fakeCancelIp } from './bankid-fake.server'
import {
  auth,
  bankidMode,
  cancel,
  checkBankidConfig,
  collect,
  messageFor,
  qrData,
} from './bankid.server'

afterEach(() => {
  vi.unstubAllEnvs()
})

// BankID's published example: https://developers.bankid.com/getting-started/frontend/qr-code
test('QR data matches the published example at t=0, 1 and 2', () => {
  const token = '67df3917-fa0d-44e5-b327-edcc928297f8' // gitleaks:allow BankID published example
  const secret = 'd28db9a7-4cde-429e-a983-359be676944c' // gitleaks:allow BankID published example
  expect([0, 1, 2].map((t) => qrData(token, secret, t))).toEqual([
    `bankid.${token}.0.dc69358e712458a66a7525beef148ae8526b1c71610eff2c16cdffb4cdac9bf8`, // gitleaks:allow BankID published example
    `bankid.${token}.1.949d559bf23403952a94d103e67743126381eda00f0b3cbddbf7c96b1adcbce2`, // gitleaks:allow BankID published example
    `bankid.${token}.2.a9e5ec59cb4eee4ef4117150abc58fad7a85439a6a96ccbecc3668b41795b3f3`, // gitleaks:allow BankID published example
  ])
})

test('fake: pending, then complete with a fresh person each time', async () => {
  const people = new Set<string>()
  for (let i = 0; i < 2; i++) {
    const { orderRef } = await auth('203.0.113.7')
    expect(await collect(orderRef)).toMatchObject({ status: 'pending' })
    const done = await collect(orderRef)
    expect(done).toMatchObject({ status: 'complete' })
    if (done.status === 'complete') people.add(done.personalNumber)
  }
  expect(people.size).toBe(2)
})

test('fake: pending, then failed with userCancel', async () => {
  const { orderRef } = await auth(fakeCancelIp)
  expect((await collect(orderRef)).status).toBe('pending')
  expect(await collect(orderRef)).toMatchObject({
    status: 'failed',
    hint: 'userCancel',
  })
})

test('fake: cancel ends the order', async () => {
  const { orderRef } = await auth('203.0.113.7')
  await cancel(orderRef)
  await expect(collect(orderRef)).rejects.toThrow()
})

test('unknown codes get the general message', () => {
  expect(messageFor('somethingNew')).toBe(messageFor(undefined))
  expect(messageFor('userCancel')).not.toBe(messageFor(undefined))
})

test('BANKID_MODE unset runs in fake and warns at startup', () => {
  vi.stubEnv('BANKID_MODE', undefined)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
    // silence the expected warning
  })
  checkBankidConfig()
  expect(bankidMode()).toBe('fake')
  expect(warn).toHaveBeenCalledOnce()
  warn.mockRestore()
})

test('production refuses to start with a fake setting', () => {
  vi.stubEnv('BANKID_MODE', 'production')
  vi.stubEnv('BANKID_FAKE_PORT', '4000')
  expect(() => {
    checkBankidConfig()
  }).toThrow(/fake setting/)
})

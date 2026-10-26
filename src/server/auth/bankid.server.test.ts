import { X509Certificate, createHash } from 'node:crypto'
import { afterEach, expect, test, vi } from 'vitest'
import { rootCa } from './bankid-ca.server'
import { fakeCancelIp } from './bankid-fake.server'
import {
  auth,
  bankidMode,
  cancel,
  checkBankidConfig,
  collect,
  failedMessage,
  messageFor,
  pendingMessage,
  qrData,
  tlsOptions,
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

test('fake: pending, then complete with the same person for the same IP', async () => {
  const people = new Set<string>()
  for (let i = 0; i < 2; i++) {
    const { orderRef } = await auth('203.0.113.7')
    expect(await collect(orderRef, false)).toMatchObject({ status: 'pending' })
    const done = await collect(orderRef, false)
    expect(done).toMatchObject({ status: 'complete' })
    if (done.status === 'complete') people.add(done.personalNumber)
  }
  expect(people.size).toBe(1)
})

test('fake: pending, then failed with userCancel', async () => {
  const { orderRef } = await auth(fakeCancelIp)
  expect((await collect(orderRef, false)).status).toBe('pending')
  expect(await collect(orderRef, false)).toMatchObject({
    status: 'failed',
    hint: 'userCancel',
  })
})

test('fake: cancel ends the order', async () => {
  const { orderRef } = await auth('203.0.113.7')
  await cancel(orderRef)
  await expect(collect(orderRef, false)).rejects.toThrow()
})

test('user messages are the RFA texts', () => {
  expect(pendingMessage('outstandingTransaction', true)).toBe(
    'Försöker starta BankID-appen.',
  )
  expect(pendingMessage('outstandingTransaction', false)).toBe(
    'Starta BankID-appen.',
  )
  expect(pendingMessage('noClient', true)).toBe('Starta BankID-appen.')
  expect(pendingMessage('started', false)).toBe(
    'Söker efter BankID. Säkerställ att du har ett giltigt BankID på den här enheten.',
  )
  expect(pendingMessage('userSign', false)).toBe(
    'Skriv in din säkerhetskod i BankID-appen och välj Identifiera eller Skriv under.',
  )
  expect(pendingMessage('processing', false)).toBe(
    'En identifiering eller underskrift pågår.',
  )
  expect(pendingMessage('somethingNew', false)).toBe(
    'En identifiering eller underskrift pågår.',
  )
  expect(failedMessage('expiredTransaction', false)).toBe(
    'BankID-appen svarar inte. Kontrollera att den är startad och att du har internetanslutning. Försök sedan igen.',
  )
  expect(failedMessage('certificateErr', false)).toBe(
    'Ditt BankID är för gammalt eller spärrat. Använd ett annat BankID eller skaffa ett nytt hos din bank.',
  )
  expect(failedMessage('userCancel', false)).toBe('Åtgärden avbröts.')
  expect(failedMessage('cancelled', false)).toBe(
    'Åtgärden avbröts. Försök igen.',
  )
  expect(failedMessage('startFailed', false)).toBe(
    'Misslyckades att läsa av QR-koden. Starta BankID-appen och läs av QR-koden.',
  )
  expect(failedMessage('startFailed', true)).toBe(
    'Du verkar inte ha BankID-appen/programmet. Installera den och skaffa ett BankID hos din bank.',
  )
  expect(failedMessage('somethingNew', false)).toBe(
    'Något gick fel. Försök igen.',
  )
  expect(messageFor('alreadyInProgress')).toBe(
    'En identifiering eller underskrift pågår redan för ditt personnummer. Försök igen.',
  )
  expect(messageFor('somethingNew')).toBe('Något gick fel. Försök igen.')
})

test('BANKID_MODE unset runs in fake and warns at startup (local dev)', () => {
  vi.stubEnv('APP_ENV', undefined)
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

test.each([
  ['APP_ENV test', 'test'],
  ['APP_ENV production', 'production'],
])('%s refuses to start without BANKID_MODE or PUBLIC_URL', (_l, env) => {
  vi.stubEnv('APP_ENV', env)
  vi.stubEnv('BANKID_MODE', 'fake')
  vi.stubEnv('PUBLIC_URL', undefined)
  expect(() => {
    checkBankidConfig()
  }).toThrow(/PUBLIC_URL/)
  vi.stubEnv('PUBLIC_URL', 'https://app.example')
  vi.stubEnv('BANKID_MODE', undefined)
  expect(() => {
    checkBankidConfig()
  }).toThrow(/BANKID_MODE/)
  vi.stubEnv('BANKID_MODE', 'fake')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {
    // silence the expected warning
  })
  expect(() => {
    checkBankidConfig()
  }).not.toThrow()
  warn.mockRestore()
})

// Published at https://cdn.bankid.com/pki/bankid/ (linked from developers.bankid.com).
test("the committed root CAs are BankID's, by pinned SHA-256 fingerprint", () => {
  const sha = (pem: string) =>
    createHash('sha256').update(new X509Certificate(pem).raw).digest('hex')
  expect(sha(rootCa.test)).toBe(
    'c6faeaf8ccadcfd0738dc99140ca788c1a19a93f843c5a9ec1369872d50e45f2',
  )
  expect(sha(rootCa.production)).toBe(
    'ca32588e385b961d58e26010c6f8c839f7ca071e497de6b7841640a61506fd31',
  )
})

test('TLS trusts the committed root CA, not BANKID_ROOT_CA_PEM', () => {
  vi.stubEnv('BANKID_P12_BASE64', 'AA==')
  vi.stubEnv('BANKID_P12_PASSPHRASE', 'x')
  vi.stubEnv('BANKID_ROOT_CA_PEM', 'ignored')
  expect(tlsOptions('test').ca).toBe(rootCa.test)
  expect(tlsOptions('production').ca).toBe(rootCa.production)
})

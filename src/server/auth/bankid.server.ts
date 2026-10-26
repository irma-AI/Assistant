import { createHmac } from 'node:crypto'
import { request } from 'node:https'
import { request as httpRequest } from 'node:http'
import { rootCa } from './bankid-ca.server'
import { createFakeBankId } from './bankid-fake.server'
import { log, outsideCall } from '../log.server'

const modes = ['fake', 'test', 'production'] as const
const hosts = {
  test: 'appapi2.test.bankid.com',
  production: 'appapi2.bankid.com',
}

export function bankidMode() {
  const mode = process.env.BANKID_MODE ?? 'fake'
  const found = modes.find((m) => m === mode)
  if (!found) throw new Error(`BANKID_MODE must be one of ${modes.join(', ')}`)
  return found
}

// Called once at startup: test and production must set the mode and the public address themselves (a default
// there would fail open), production must carry no fake setting, and the mode is always logged.
export function checkBankidConfig() {
  if (['test', 'production'].includes(process.env.APP_ENV ?? '')) {
    const missing = ['BANKID_MODE', 'PUBLIC_URL'].filter((k) => !process.env[k])
    if (missing.length > 0)
      throw new Error(
        `${missing.join(' and ')} must be set when APP_ENV is ${process.env.APP_ENV ?? ''}`,
      )
  }
  const mode = bankidMode()
  const fake = Object.keys(process.env).filter((k) =>
    k.startsWith('BANKID_FAKE'),
  )
  if (mode === 'production' && fake.length > 0)
    throw new Error(
      `BANKID_MODE=production with fake setting ${fake.join(', ')}`,
    )
  log(mode === 'fake' ? 'warn' : 'info', 'startup', {
    bankid_mode: mode,
    version: process.env.APP_VERSION ?? 'dev',
    msg:
      mode === 'fake'
        ? 'Started; BankID is fake (synthetic logins, not verified)'
        : `Started; BankID mode ${mode}`,
  })
}

// qrStartSecret never leaves the server; the browser only gets the string for the current second.
export const qrData = (token: string, secret: string, seconds: number) =>
  `bankid.${token}.${String(seconds)}.${createHmac('sha256', secret).update(String(seconds)).digest('hex')}`

// BankID's recommended user messages (RFA numbers), word for word; see docs/plans/IRM-110.md.
const pending: Record<string, string> = {
  outstandingTransaction: 'Starta BankID-appen.',
  noClient: 'Starta BankID-appen.',
  started:
    'Söker efter BankID. Säkerställ att du har ett giltigt BankID på den här enheten.',
  userSign:
    'Skriv in din säkerhetskod i BankID-appen och välj Identifiera eller Skriv under.',
}
const failed: Record<string, string> = {
  expiredTransaction:
    'BankID-appen svarar inte. Kontrollera att den är startad och att du har internetanslutning. Försök sedan igen.',
  certificateErr:
    'Ditt BankID är för gammalt eller spärrat. Använd ett annat BankID eller skaffa ett nytt hos din bank.',
  userCancel: 'Åtgärden avbröts.',
  cancelled: 'Åtgärden avbröts. Försök igen.',
  alreadyInProgress:
    'En identifiering eller underskrift pågår redan för ditt personnummer. Försök igen.',
}
const inProgress = 'En identifiering eller underskrift pågår.' // RFA21, also for unknown pending codes
const wentWrong = 'Något gick fel. Försök igen.' // RFA22, also for unknown failed codes

// A pending order's message; a same-device login that is still outstanding is starting the app (RFA13).
export const pendingMessage = (
  hint: string | undefined,
  sameDevice: boolean,
) =>
  hint === 'outstandingTransaction' && sameDevice
    ? 'Försöker starta BankID-appen.'
    : ((hint && pending[hint]) ?? inProgress)

export const failedMessage = (hint: string | undefined, sameDevice: boolean) =>
  hint === 'startFailed'
    ? sameDevice
      ? 'Du verkar inte ha BankID-appen/programmet. Installera den och skaffa ett BankID hos din bank.'
      : 'Misslyckades att läsa av QR-koden. Starta BankID-appen och läs av QR-koden.'
    : ((hint && failed[hint]) ?? wentWrong)

// An error from a BankID call that gave no usable reply (RFA22).
export const messageFor = (code: string | undefined) =>
  (code && failed[code]) || wentWrong

let fakeUrl: Promise<string> | undefined
function baseFor(mode: 'fake' | 'test' | 'production') {
  if (mode !== 'fake') return Promise.resolve(`https://${hosts[mode]}`)
  fakeUrl ??= createFakeBankId(Number(process.env.BANKID_FAKE_PORT ?? 0)).then(
    (f) => f.url,
  )
  return fakeUrl
}

// Mutual TLS with our certificate; only BankID's root CA is trusted, not the server's own certificate.
export function tlsOptions(mode: 'test' | 'production') {
  const p12 = process.env.BANKID_P12_BASE64
  const passphrase = process.env.BANKID_P12_PASSPHRASE
  if (!p12 || !passphrase)
    throw new Error('BANKID_P12_BASE64 and BANKID_P12_PASSPHRASE are required')
  return { pfx: Buffer.from(p12, 'base64'), passphrase, ca: rootCa[mode] }
}

const call = (path: string, body: object) =>
  outsideCall(`bankid.${path}`, () => send(path, body))

async function send(path: string, body: object): Promise<unknown> {
  const mode = bankidMode()
  const url = new URL(`/rp/v6.0/${path}`, await baseFor(mode))
  const open = mode === 'fake' ? httpRequest : request
  const options = mode === 'fake' ? {} : tlsOptions(mode)
  return new Promise((resolve, reject) => {
    const req = open(
      url,
      {
        ...options,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        timeout: 15000,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => {
          let json: unknown
          try {
            json = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          } catch {
            reject(new Error(wentWrong))
            return
          }
          if (res.statusCode === 200) {
            resolve(json)
            return
          }
          const code = isRecord(json) ? str(json.errorCode) : ''
          reject(new Error(messageFor(code)))
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error(wentWrong)))
    req.on('error', reject)
    req.end(JSON.stringify(body))
  })
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export type Web = {
  referringDomain: string
  userAgent: string
  deviceIdentifier: string
}

// returnRisk makes collect report the order's risk; web and returnUrl are sent for a browser login;
// userVisibleData is the text BankID shows the person while they identify.
export async function auth(
  endUserIp: string,
  options: { web?: Web; returnUrl?: string; userVisibleData?: string } = {},
) {
  const { userVisibleData, ...rest } = options
  const r = await call('auth', {
    endUserIp,
    returnRisk: true,
    ...rest,
    ...(userVisibleData && {
      userVisibleData: Buffer.from(userVisibleData).toString('base64'),
    }),
  })
  if (!isRecord(r)) throw new Error(wentWrong)
  return {
    orderRef: str(r.orderRef),
    autoStartToken: str(r.autoStartToken),
    qrStartToken: str(r.qrStartToken),
    qrStartSecret: str(r.qrStartSecret),
  }
}

export async function collect(orderRef: string, sameDevice: boolean) {
  const r = await call('collect', { orderRef })
  if (!isRecord(r)) throw new Error(wentWrong)
  if (r.status === 'complete') {
    const data = isRecord(r.completionData) ? r.completionData : {}
    const user = isRecord(data.user) ? data.user : {}
    return {
      status: 'complete' as const,
      personalNumber: str(user.personalNumber),
      name: str(user.name),
      ip: isRecord(data.device) ? str(data.device.ipAddress) : '',
      risk: str(data.risk),
    }
  }
  const hint = str(r.hintCode)
  const status = r.status === 'pending' ? 'pending' : 'failed'
  const message =
    status === 'pending'
      ? pendingMessage(hint, sameDevice)
      : failedMessage(hint, sameDevice)
  return { status, hint, message } as const
}

export async function cancel(orderRef: string) {
  await call('cancel', { orderRef })
}

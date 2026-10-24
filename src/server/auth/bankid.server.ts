import { createHmac } from 'node:crypto'
import { request } from 'node:https'
import { request as httpRequest } from 'node:http'
import { createFakeBankId } from './bankid-fake.server'

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

// Called once at startup: production must carry no fake setting, and the mode is always logged.
export function checkBankidConfig() {
  const mode = bankidMode()
  const fake = Object.keys(process.env).filter((k) =>
    k.startsWith('BANKID_FAKE'),
  )
  if (mode === 'production' && fake.length > 0)
    throw new Error(
      `BANKID_MODE=production with fake setting ${fake.join(', ')}`,
    )
  const line = `BankID mode: ${mode}`
  if (mode === 'fake') console.warn(`${line} (synthetic logins, not verified)`)
  else console.log(line)
}

// qrStartSecret never leaves the server; the browser only gets the string for the current second.
export const qrData = (token: string, secret: string, seconds: number) =>
  `bankid.${token}.${String(seconds)}.${createHmac('sha256', secret).update(String(seconds)).digest('hex')}`

const messages: Record<string, string> = {
  outstandingTransaction: 'Open the BankID app.',
  noClient: 'Open the BankID app.',
  started: 'Searching for BankID. Open the app if nothing happens.',
  userSign: 'Identify yourself in the BankID app.',
  userCancel: 'The login was cancelled.',
  cancelled: 'The login was cancelled.',
  expiredTransaction: 'The BankID app did not respond. Try again.',
  startFailed: 'The BankID app did not start. Try again.',
}
const general = 'Something went wrong with BankID. Try again.'
// BankID's general rules: an unknown hint or error code gets a general message.
export const messageFor = (code: string | undefined) =>
  (code && messages[code]) || general

let fakeUrl: Promise<string> | undefined
function baseFor(mode: 'fake' | 'test' | 'production') {
  if (mode !== 'fake') return Promise.resolve(`https://${hosts[mode]}`)
  fakeUrl ??= createFakeBankId(Number(process.env.BANKID_FAKE_PORT ?? 0)).then(
    (f) => f.url,
  )
  return fakeUrl
}

// Mutual TLS with our certificate; only BankID's root CA is trusted, not the server's own certificate.
function tlsOptions() {
  const p12 = process.env.BANKID_P12_BASE64
  const passphrase = process.env.BANKID_P12_PASSPHRASE
  const ca = process.env.BANKID_ROOT_CA_PEM
  if (!p12 || !passphrase || !ca)
    throw new Error(
      'BANKID_P12_BASE64, BANKID_P12_PASSPHRASE and BANKID_ROOT_CA_PEM are required',
    )
  return { pfx: Buffer.from(p12, 'base64'), passphrase, ca }
}

async function call(path: string, body: object): Promise<unknown> {
  const mode = bankidMode()
  const url = new URL(`/rp/v6.0/${path}`, await baseFor(mode))
  const send = mode === 'fake' ? httpRequest : request
  const options = mode === 'fake' ? {} : tlsOptions()
  return new Promise((resolve, reject) => {
    const req = send(
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
            reject(new Error(general))
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
    req.on('timeout', () => req.destroy(new Error(general)))
    req.on('error', reject)
    req.end(JSON.stringify(body))
  })
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export async function auth(endUserIp: string) {
  const r = await call('auth', { endUserIp })
  if (!isRecord(r)) throw new Error(general)
  return {
    orderRef: str(r.orderRef),
    autoStartToken: str(r.autoStartToken),
    qrStartToken: str(r.qrStartToken),
    qrStartSecret: str(r.qrStartSecret),
  }
}

export async function collect(orderRef: string) {
  const r = await call('collect', { orderRef })
  if (!isRecord(r)) throw new Error(general)
  if (r.status === 'complete') {
    const data = isRecord(r.completionData) ? r.completionData : {}
    const user = isRecord(data.user) ? data.user : {}
    return {
      status: 'complete' as const,
      personalNumber: str(user.personalNumber),
      name: str(user.name),
    }
  }
  const hint = str(r.hintCode)
  const status = r.status === 'pending' ? 'pending' : 'failed'
  return { status, hint, message: messageFor(hint) } as const
}

export async function cancel(orderRef: string) {
  await call('cancel', { orderRef })
}

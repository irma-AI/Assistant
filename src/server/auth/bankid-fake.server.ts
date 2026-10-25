import { randomInt, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

// An end user IP in TEST-NET-1 (RFC 5737) makes the fake's order fail with userCancel; any other IP completes.
export const fakeCancelIp = '192.0.2.1'
// Other TEST-NET-1 addresses make the order complete with high risk, expire, or complete from another IP.
export const fakeHighRiskIp = '192.0.2.2'
export const fakeExpiredIp = '192.0.2.3'
export const fakeOtherIp = '192.0.2.4'
export const fakeBusyIp = '192.0.2.5' // /auth answers alreadyInProgress

const givenNames = ['Anna', 'Erik', 'Maja', 'Oskar', 'Saga', 'Nils']
const surnames = ['Lind', 'Berg', 'Holm', 'Nyman', 'Sjö', 'Ek']

const luhn = (digits: string) => {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]) * (i % 2 === 0 ? 2 : 1)
    sum += d > 9 ? d - 9 : d
  }
  return (10 - (sum % 10)) % 10
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

// A made-up person: random birth date and serial with a valid check digit.
function makePerson() {
  const year = 1940 + randomInt(60)
  const body = `${pad(year % 100, 2)}${pad(1 + randomInt(12), 2)}${pad(1 + randomInt(28), 2)}${pad(randomInt(1000), 3)}`
  const givenName = givenNames[randomInt(givenNames.length)] ?? 'Anna'
  const surname = surnames[randomInt(surnames.length)] ?? 'Lind'
  return {
    personalNumber: `${String(year)}${body.slice(2)}${String(luhn(body))}`,
    name: `${givenName} ${surname}`,
    givenName,
    surname,
  }
}

type Order = { ip: string; collects: number }
type Fake = { orders: Map<string, Order>; returnUrls: Map<string, string> }

const fail = (errorCode: string): [number, object] => [
  400,
  { errorCode, details: errorCode },
]

// The same IP is the same person every time, so a later confirmation can find the account it logged in to.
const people = new Map<string, ReturnType<typeof makePerson>>()

// The last collect of an order: the IP decides how the made-up login ends.
function finished(orderRef: string, ip: string) {
  const failed = (hintCode: string) => ({
    orderRef,
    status: 'failed',
    hintCode,
  })
  if (ip === fakeCancelIp) return failed('userCancel')
  if (ip === fakeExpiredIp) return failed('expiredTransaction')
  return {
    orderRef,
    status: 'complete',
    completionData: {
      user: people.get(ip) ?? people.set(ip, makePerson()).get(ip),
      device: { ipAddress: ip === fakeOtherIp ? '198.51.100.9' : ip },
      risk: ip === fakeHighRiskIp ? 'high' : 'low',
    },
  }
}

// Implements /auth, /collect and /cancel of BankID RP API v6.0 on a local port, in the app's own process.
function handle(
  fake: Fake,
  url: string,
  body: Record<string, unknown>,
): [number, object] {
  {
    const { orders } = fake
    if (url === '/rp/v6.0/auth') {
      if (typeof body.endUserIp !== 'string') return fail('invalidParameters')
      if (body.endUserIp === fakeBusyIp) return fail('alreadyInProgress')
      const orderRef = randomUUID()
      orders.set(orderRef, { ip: body.endUserIp, collects: 0 })
      if (typeof body.returnUrl === 'string')
        fake.returnUrls.set(body.endUserIp, body.returnUrl)
      return [
        200,
        {
          orderRef,
          autoStartToken: randomUUID(),
          qrStartToken: randomUUID(),
          qrStartSecret: randomUUID(),
        },
      ]
    }
    const ref = typeof body.orderRef === 'string' ? body.orderRef : ''
    const order = orders.get(ref)
    if (!order) return fail('invalidParameters')
    if (url === '/rp/v6.0/cancel') {
      orders.delete(ref)
      return [200, {}]
    }
    if (url !== '/rp/v6.0/collect') return fail('invalidParameters')
    order.collects += 1
    if (order.collects === 1)
      return [
        200,
        {
          orderRef: ref,
          status: 'pending',
          hintCode: 'outstandingTransaction',
        },
      ]
    // A finished order stays collectable, as at BankID, so a second tab can still read the result.
    return [200, finished(ref, order.ip)]
  }
}

// GET /last-return-url?ip= lets e2e follow the returnUrl of the latest auth from that IP, as the BankID app would.
function route(
  fake: Fake,
  method: string | undefined,
  url: string,
  body: Record<string, unknown>,
): [number, object] {
  if (method === 'GET' && url.startsWith('/last-return-url')) {
    const ip = new URL(url, 'http://fake').searchParams.get('ip') ?? ''
    return [200, { returnUrl: fake.returnUrls.get(ip) ?? '' }]
  }
  return method === 'POST' ? handle(fake, url, body) : fail('methodNotAllowed')
}

export function createFakeBankId(port = 0) {
  const fake: Fake = {
    orders: new Map<string, Order>(),
    returnUrls: new Map<string, string>(),
  }
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      let body: Record<string, unknown> = {}
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString())
        if (typeof parsed === 'object' && parsed !== null) body = { ...parsed }
      } catch {
        // an unparsable body is handled as no parameters
      }
      const [status, json] = route(fake, req.method, req.url ?? '', body)
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(json))
    })
  })
  return new Promise<{ url: string; close: () => void }>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') {
        reject(new Error('fake BankID has no port'))
        return
      }
      server.unref()
      resolve({
        url: `http://127.0.0.1:${String(addr.port)}`,
        close: () => server.close(),
      })
    })
  })
}

import { expect, test } from 'vitest'
import { z } from 'zod'

// Every /api/v1 handler must answer 401 without a session (OWASP API1:2023),
// unless it is on this list with its reason. A new public endpoint is a decision, so it is added here on purpose.
const publicHandlers: Record<string, string> = {
  'auth/bankid/cancel POST': 'login: the caller has no session yet',
  'auth/bankid/extend POST': 'login: the caller has no session yet',
  'auth/bankid/mode GET': 'the login screen reads it before login',
  'auth/bankid/start POST': 'login: starts BankID',
  'auth/bankid/status POST': 'login: polls BankID',
  'auth/demo POST': 'login: demo account',
  'auth/demo/delete POST': 'demo: deletes the demo account by its own token',
  'invites/$token GET':
    'the invite screen reads the organisation name before login',
  'notifications/unsubscribe GET':
    'the link in an email carries a signed proof, and the reader has no session',
  'notifications/unsubscribe POST':
    "a mail provider's one-click unsubscribe sends the same signed link",
  'logout POST': 'logging out twice is not an error',
}

const handler = z.custom<
  (ctx: { request: Request; params: object }) => Response | Promise<Response>
>((v) => typeof v === 'function')
const routeModule = z.object({
  Route: z.object({
    options: z.object({
      server: z.object({ handlers: z.record(z.string(), handler) }),
    }),
  }),
})

const modules = import.meta.glob('./**/*.ts', { eager: true })

test('every handler requires a session unless listed as public', async () => {
  const found: string[] = []
  const open: string[] = []
  for (const [file, mod] of Object.entries(modules)) {
    const parsed = routeModule.safeParse(mod)
    if (!parsed.success) continue
    const name = file.slice(2, -3).replace(/\/index$/, '')
    for (const [method, h] of Object.entries(
      parsed.data.Route.options.server.handlers,
    )) {
      const key = `${name} ${method}`
      found.push(key)
      const res = await h({
        request: new Request('https://api.test/api/v1/x', { method }),
        params: {},
      })
      if (res.status !== 401 && !(key in publicHandlers))
        open.push(`${key} -> ${String(res.status)}`)
    }
  }
  expect(found.length).toBeGreaterThan(0)
  expect(open).toEqual([])
  expect(Object.keys(publicHandlers).filter((k) => !found.includes(k))).toEqual(
    [],
  )
})

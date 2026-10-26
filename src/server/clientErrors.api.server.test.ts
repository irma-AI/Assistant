import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { clearClientErrorLimit, clientErrors } from './clientErrors.api.server'
import { linesOf } from './log.fixture'
import { useDatabase } from './orgs.fixture'

useDatabase()

const valid = {
  name: 'TypeError',
  message: 'x is undefined',
  stack: 'TypeError: x is undefined\n    at f (app.js:1:1)',
  route: '/app/org/:orgId',
  version: 'abc123',
}
const send = (body: object, ip = '203.0.113.5') =>
  clientErrors(
    new Request('https://app.example/api/v1/client-errors', {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  )

const spy = () => vi.spyOn(process.stdout, 'write').mockReturnValue(true)
let out = spy()
beforeEach(() => {
  clearClientErrorLimit()
  out = spy()
})
afterEach(() => {
  out.mockRestore()
  vi.unstubAllEnvs()
})

test('a valid report writes one client error line with the five fields, cut to length, and no address', async () => {
  const response = await send({ ...valid, message: 'm'.repeat(1000) })
  expect(response.status).toBe(204)
  const lines = linesOf(out.mock.calls)
  expect(lines).toHaveLength(1)
  expect(lines[0]).toMatchObject({
    level: 'error',
    event: 'client_error',
    service: 'client',
    route: valid.route,
    app_version: valid.version,
    'error.name': valid.name,
    'error.stack': valid.stack,
  })
  expect(String(lines[0]?.['error.message'])).toHaveLength(300)
  expect(JSON.stringify(lines[0])).not.toContain('203.0.113')
})

test('a field outside the five, a missing one or a bad body gives 400 and no line', async () => {
  for (const body of [{ ...valid, user: 'Test Person' }, { name: 'x' }, []])
    expect((await send(body)).status).toBe(400)
  expect(linesOf(out.mock.calls)).toHaveLength(0)
})

test('a body over the cap gives 413', async () => {
  expect((await send({ ...valid, stack: 's'.repeat(20_000) })).status).toBe(413)
})

test('over the limit gives 429 for that network only', async () => {
  vi.stubEnv('CLIENT_ERROR_LIMIT', '2')
  expect((await send(valid)).status).toBe(204)
  expect((await send(valid, '203.0.113.99')).status).toBe(204)
  expect((await send(valid)).status).toBe(429)
  expect((await send(valid, '198.51.100.1')).status).toBe(204)
})

import { expect, test } from 'vitest'
import { requestLine } from './requestLog'

test('logs method, path and status, never the query string', () => {
  const line = requestLine(
    new Request('https://x.test/api/v1/me?token=secret'),
    200,
    12.4,
  )
  expect(JSON.parse(line)).toMatchObject({
    level: 'info',
    event: 'http_request',
    method: 'GET',
    path: '/api/v1/me',
    status: 200,
    duration_ms: 12,
  })
  expect(line).not.toContain('secret')
})

test('a 5xx is logged as an error', () => {
  const line = requestLine(new Request('https://x.test/api/v1/me'), 503, 1)
  expect(JSON.parse(line)).toMatchObject({ level: 'error' })
})

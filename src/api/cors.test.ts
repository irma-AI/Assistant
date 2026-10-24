import { expect, test } from 'vitest'
import { preflight, withCors } from './cors'

const req = (method: string, origin?: string) =>
  new Request('https://api.test/api/v1/me', {
    method,
    headers: origin ? { origin } : {},
  })

test.each(['capacitor://localhost', 'https://localhost'])(
  'preflight from %s is allowed',
  (origin) => {
    const response = preflight(req('OPTIONS', origin))
    expect(response?.status).toBe(204)
    expect(response?.headers.get('access-control-allow-origin')).toBe(origin)
    expect(response?.headers.get('vary')).toBe('Origin')
    expect(response?.headers.get('access-control-allow-headers')).toBe(
      'authorization, content-type',
    )
  },
)

test('preflight from a foreign origin is 403', () => {
  expect(preflight(req('OPTIONS', 'https://evil.test'))?.status).toBe(403)
})

test('a request that is not a preflight is left alone', () => {
  expect(preflight(req('GET', 'https://localhost'))).toBeUndefined()
  expect(preflight(req('OPTIONS'))).toBeUndefined()
})

test('an error to an allowed origin carries the CORS headers', () => {
  const response = withCors(
    req('GET', 'https://localhost'),
    Response.json({ error: 'unauthorized' }, { status: 401 }),
  )
  expect(response.status).toBe(401)
  expect(response.headers.get('access-control-allow-origin')).toBe(
    'https://localhost',
  )
  expect(response.headers.get('vary')).toBe('Origin')
})

test('a same-origin or foreign request gets no CORS headers', () => {
  for (const request of [req('GET'), req('GET', 'https://evil.test')])
    expect(
      withCors(request, new Response('x')).headers.get(
        'access-control-allow-origin',
      ),
    ).toBeNull()
})

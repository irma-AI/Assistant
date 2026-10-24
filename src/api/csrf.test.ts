import { expect, test, vi } from 'vitest'
import { csrfBlock } from './csrf'

vi.stubEnv('PUBLIC_URL', 'https://app.example')

const post = (headers: Record<string, string>) =>
  new Request('https://app.example/api/v1/logout', { method: 'POST', headers })

test('a cross-site POST carrying the session cookie is rejected', () => {
  const cookie = '__Host-session=abc'
  expect(
    csrfBlock(post({ cookie, origin: 'https://evil.example' }))?.status,
  ).toBe(403)
  expect(csrfBlock(post({ cookie }))?.status).toBe(403)
})

test('our own origin, cookie-less app calls and reads pass', () => {
  const cookie = '__Host-session=abc'
  expect(csrfBlock(post({ cookie, origin: 'https://app.example' }))).toBe(
    undefined,
  )
  expect(
    csrfBlock(post({ authorization: 'Bearer x', origin: 'https://localhost' })),
  ).toBe(undefined)
  expect(
    csrfBlock(
      new Request('https://app.example/api/v1/me', { headers: { cookie } }),
    ),
  ).toBe(undefined)
})

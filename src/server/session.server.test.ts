import { expect, test } from 'vitest'
import { requireSession } from './session.server'

test.each([undefined, 'Bearer anything'])(
  'rejects every request (authorization: %s)',
  async (authorization) => {
    const response = requireSession(
      new Request('https://api.test/api/v1/me', {
        headers: authorization ? { authorization } : {},
      }),
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
  },
)

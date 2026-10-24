import { afterEach, expect, test } from 'vitest'
import { withNoindex } from './noindex'

const page = () =>
  new Response('<html><head><title>x</title></head></html>', {
    headers: { 'content-type': 'text/html' },
  })

afterEach(() => {
  delete process.env.APP_ENV
})

test.each(['staging', undefined])(
  'APP_ENV=%s marks a page noindex in header and head',
  async (env) => {
    if (env) process.env.APP_ENV = env
    const response = withNoindex(page())
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(await response.text()).toContain(
      '<head><meta name="robots" content="noindex">',
    )
  },
)

test('APP_ENV=production leaves a page untouched', async () => {
  process.env.APP_ENV = 'production'
  const response = withNoindex(page())
  expect(response.headers.get('x-robots-tag')).toBeNull()
  expect(await response.text()).not.toContain('robots')
})

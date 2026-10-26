import { expect, test } from 'vitest'
import { routePattern } from './routePattern'

test('a path with a token logs its pattern, an unknown path logs none', () => {
  expect(routePattern('/api/v1/invites/tok3n-SECRET')).toBe(
    '/api/v1/invites/:token',
  )
  expect(routePattern('/api/v1/me')).toBe('/api/v1/me')
  expect(routePattern('/wp-login.php')).toBe('unmatched')
})

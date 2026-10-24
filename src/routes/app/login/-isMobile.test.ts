import { expect, test } from 'vitest'
import { isMobile } from './-isMobile'

test.each([
  ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5, true],
  ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5, true],
  [
    'iPad with a desktop user agent',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    5,
    true,
  ],
  ['Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, false],
  ['Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, false],
])('%s', (_name, userAgent, touchPoints, expected) => {
  expect(isMobile(userAgent, touchPoints)).toBe(expected)
})

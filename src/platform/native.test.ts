import { expect, it } from 'vitest'

import { isNative } from './native'

it('is false in a plain browser or Node', () => {
  expect(isNative()).toBe(false)
})

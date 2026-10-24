import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiBaseUrl } from './api'
import { isNative } from './native'

vi.mock('./native', () => ({ isNative: vi.fn() }))

describe('apiBaseUrl', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is the configured origin on native', () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.example.test')
    vi.mocked(isNative).mockReturnValue(true)
    expect(apiBaseUrl()).toBe('https://api.example.test')
  })

  it('is relative on the web, whatever the origin is set to', () => {
    vi.stubEnv('VITE_API_ORIGIN', 'https://api.example.test')
    vi.mocked(isNative).mockReturnValue(false)
    expect(apiBaseUrl()).toBe('')
  })
})

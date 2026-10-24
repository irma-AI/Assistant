import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: { PII_HASH_KEY: 'test-only-pii-hash-key' },
  },
})

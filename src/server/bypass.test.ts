import { globSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

// Invariant 12 of docs/bookkeeping-foundations.md: nothing switches the ledger triggers off.
test('no migration or source file disables triggers or sets session_replication_role', () => {
  const files = [
    ...globSync('migrations/*.sql'),
    ...globSync('src/**/*.{ts,tsx}'),
  ].filter((f) => !/\.test\.tsx?$/.test(f)) // tests tamper on purpose to prove detection
  const hits = files.filter((f) =>
    /session_replication_role|disable\s+trigger|disable\s+row\s+level\s+security/i.test(
      readFileSync(f, 'utf8'),
    ),
  )
  expect(hits).toEqual([])
})

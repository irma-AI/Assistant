import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { makePeople, snapshot } from '../../seeds/people.ts'

// Luhn over the last ten digits (YYMMDDNNNC) of a 12-digit personal identity number.
function luhnValid(pin: string) {
  const sum = Array.from(pin.slice(2)).reduce((acc, ch, i) => {
    const d = Number(ch) * (i % 2 === 0 ? 2 : 1)
    return acc + (d > 9 ? d - 9 : d)
  }, 0)
  return sum % 10 === 0
}

test('the same seed makes the same people', () => {
  expect(makePeople(5, 7)).toEqual(makePeople(5, 7))
})

test('every factory number is in the snapshot, and every snapshot number has a valid check digit', () => {
  for (const p of makePeople(100)) {
    expect(snapshot.numbers).toContain(p.personalIdentityNumber)
  }
  for (const n of snapshot.numbers) {
    expect(n).toMatch(/^\d{12}$/)
    expect(luhnValid(n)).toBe(true)
  }
})

test('emails and phones are the reserved fiction ones', () => {
  for (const p of makePeople(20)) {
    expect(p.email).toMatch(/@example\.(com|org|net)$/)
    expect(p.phone).toMatch(/^07017406\d\d$/)
  }
})

test('synthetic-data guard passes once a users migration meets the faker seed, and fails without it', () => {
  const root = mkdtempSync(join(tmpdir(), 'synthetic-'))
  mkdirSync(join(root, 'migrations'))
  writeFileSync(
    join(root, 'migrations', '0099_users.sql'),
    'create table users (id uuid primary key, email text not null);',
  )
  const run = () => execFileSync('guards/synthetic-data.sh', [root])
  expect(run).toThrow()
  mkdirSync(join(root, 'seeds'))
  execFileSync('cp', ['seeds/people.ts', join(root, 'seeds')])
  expect(run).not.toThrow()
})

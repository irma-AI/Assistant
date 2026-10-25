import { sql } from 'kysely'
import { expect, test, vi } from 'vitest'
import { startJobs } from './jobs.server'
import { db, testUrl, useDatabase } from './orgs.fixture'

useDatabase()

const until = (check: () => Promise<unknown>) =>
  vi.waitFor(check, { timeout: 20000, interval: 200 })

const stale = () =>
  db
    .insertInto('login_attempts')
    .values({
      order_ref: 'o',
      qr_start_token: 't',
      qr_start_secret: 's',
      end_user_ip: '203.0.113.1',
      created_at: sql`now() - interval '2 hours'`,
    })
    .execute()

const count = async () =>
  (await db.selectFrom('login_attempts').select('id').execute()).length

test('a queued sweep deletes stale login attempts', async () => {
  await stale()
  const boss = await startJobs(db, testUrl())
  await boss.send('login-attempt-sweep', {})
  await until(async () => {
    expect(await count()).toBe(0)
  })
  await boss.stop()
})

test('a failed job is retried, and the same queue never runs two at once', async () => {
  await stale()
  let calls = 0
  const boss = await startJobs(db, testUrl(), {
    'login-attempt-sweep': async () => {
      calls++
      if (calls === 1) throw new Error('forced failure')
      await db.deleteFrom('login_attempts').execute()
    },
  })
  await boss.updateQueue('login-attempt-sweep', { retryDelay: 1 })
  const first = await boss.send(
    'login-attempt-sweep',
    {},
    { singletonKey: 'org-1' },
  )
  const second = await boss.send(
    'login-attempt-sweep',
    {},
    { singletonKey: 'org-1' },
  )
  expect(first).toBeTruthy()
  expect(second).toBeNull()
  await until(async () => {
    expect(calls).toBe(2)
  })
  await until(async () => {
    expect(await count()).toBe(0)
  })
  await boss.stop()
})

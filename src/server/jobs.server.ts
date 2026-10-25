import { PgBoss } from 'pg-boss'
import type { Kysely } from 'kysely'
import type { DB } from './db.gen'
import { deleteStaleLoginAttempts } from './login.server'

const deadLetter = 'dead-letter'

type Run = (db: Kysely<DB>) => Promise<unknown>

// Every job is idempotent: a retry after a crash must not duplicate its effect.
const jobs: { name: string; cron: string; run: Run }[] = [
  {
    name: 'login-attempt-sweep',
    cron: '*/15 * * * *',
    run: deleteStaleLoginAttempts,
  },
]

// Failures carry the job id and queue only, never the payload, which may hold personal data.
const logFailure = (what: string, job: { id: string; name: string }) => {
  console.error(what, job.name, job.id)
}

// shortcut: runs inside the app process, move to a worker container when a job slows web requests.
export async function startJobs(
  db: Kysely<DB>,
  connectionString: string,
  override: Record<string, Run> = {},
) {
  const boss = new PgBoss(connectionString)
  boss.on('error', (e) => {
    console.error('job queue error', e.message)
  })
  await boss.start()
  await boss.createQueue(deadLetter)
  await boss.work(deadLetter, async (failed) => {
    for (const job of failed) logFailure('job in dead-letter queue', job)
  })
  for (const { name, cron, run } of jobs) {
    await boss.createQueue(name, {
      policy: 'stately',
      retryLimit: 3,
      retryDelay: 30,
      retryBackoff: true,
      deadLetter,
    })
    await boss.work(name, async (batch) => {
      for (const job of batch) {
        try {
          await (override[name] ?? run)(db)
        } catch (e) {
          logFailure('job failed', job)
          throw e
        }
      }
    })
    await boss.schedule(name, cron)
  }
  return boss
}

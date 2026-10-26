import { PgBoss } from 'pg-boss'
import type { Kysely } from 'kysely'
import type { DB } from './db.gen'
import { sendMail } from './email.server'
import { deleteStaleLoginAttempts } from './login.server'
import { cut, job, log } from './log.server'
import { deliverEmails } from './notifications.delivery.server'
import { deleteOldEvents } from './notifications.server'

const deadLetter = 'dead-letter'

type Run = (db: Kysely<DB>) => Promise<unknown>

// Every job is idempotent: a retry after a crash must not duplicate its effect.
const jobs: { name: string; cron: string; run: Run }[] = [
  {
    name: 'login-attempt-sweep',
    cron: '*/15 * * * *',
    run: deleteStaleLoginAttempts,
  },
  {
    name: 'notification-email',
    cron: '* * * * *',
    run: (db) => deliverEmails(db, sendMail),
  },
  {
    name: 'notification-sweep',
    cron: '17 3 * * *',
    run: deleteOldEvents,
  },
]

// shortcut: runs inside the app process, move to a worker container when a job slows web requests.
export async function startJobs(
  db: Kysely<DB>,
  connectionString: string,
  override: Record<string, Run> = {},
) {
  const boss = new PgBoss(connectionString)
  boss.on('error', (e) => {
    log('error', 'job', {
      job: 'queue',
      outcome: 'failed',
      msg: 'The job queue reported an error: check the database connection',
      'error.message': cut(e.message),
    })
  })
  await boss.start()
  await boss.createQueue(deadLetter)
  await boss.work(deadLetter, async (failed) => {
    // Only the queue name: a payload may hold personal data.
    for (const f of failed)
      log('error', 'job', {
        job: f.name,
        outcome: 'dead_letter',
        msg: 'A job ran out of retries: read its earlier failed runs',
      })
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
      // One run per job in the batch, each idempotent.
      await job(name, async () => {
        await Promise.all(batch.map(() => (override[name] ?? run)(db)))
      })
    })
    await boss.schedule(name, cron)
  }
  return boss
}

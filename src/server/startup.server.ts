import { definePlugin } from 'nitro'
import { deleteExpiredAuditEvents } from './audit.server'
import { checkBankidConfig } from './auth/bankid.server'
import { getDb } from './db.server'
import { startJobs } from './jobs.server'
import { errorFields, job, log, logShutdown } from './log.server'
import { deleteEndedSessions } from './session.server'

const day = 24 * 60 * 60 * 1000

// Runs once when the server starts; the build's prerender starts it too, with no secrets or database.
export default definePlugin(() => {
  if (process.env.TSS_PRERENDERING) return
  if (process.env.NODE_ENV === 'production' && !process.env.PII_HASH_KEY)
    throw new Error('PII_HASH_KEY is not set')
  checkBankidConfig()
  // The server's own handler for these signals stops it; this one only writes the line.
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, logShutdown)
  // A failing sweep is logged by job(); the next run retries.
  const every = (name: string, run: () => Promise<unknown>) => {
    const tick = () => void job(name, run).catch(() => undefined)
    tick()
    setInterval(tick, day).unref()
  }
  every('session-sweep', () => deleteEndedSessions(getDb()))
  every('audit-sweep', () => deleteExpiredAuditEvents(getDb()))
  const url = process.env.DATABASE_URL
  if (url)
    startJobs(getDb(), url).catch((e: unknown) => {
      log('error', 'job', {
        job: 'queue',
        outcome: 'failed',
        msg: 'The job queue failed to start: check the database connection',
        ...errorFields(e),
      })
    })
})

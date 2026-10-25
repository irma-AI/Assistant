import { definePlugin } from 'nitro'
import { deleteExpiredAuditEvents } from './audit.server'
import { checkBankidConfig } from './auth/bankid.server'
import { getDb } from './db.server'
import { deleteStaleLoginAttempts } from './login.server'
import { deleteEndedSessions } from './session.server'

const day = 24 * 60 * 60 * 1000
const quarterHour = 15 * 60 * 1000

// Runs once when the server starts; the build's prerender starts it too, with no secrets or database.
export default definePlugin(() => {
  if (process.env.TSS_PRERENDERING) return
  if (process.env.NODE_ENV === 'production' && !process.env.PII_HASH_KEY)
    throw new Error('PII_HASH_KEY is not set')
  checkBankidConfig()
  const sweep = async () => {
    try {
      await deleteEndedSessions(getDb())
    } catch (e) {
      console.error(
        'session cleanup failed',
        e instanceof Error ? e.message : e,
      )
    }
  }
  void sweep()
  setInterval(() => void sweep(), day).unref()
  const sweepAudit = async () => {
    try {
      await deleteExpiredAuditEvents(getDb())
    } catch (e) {
      console.error(
        'audit log cleanup failed',
        e instanceof Error ? e.message : e,
      )
    }
  }
  void sweepAudit()
  setInterval(() => void sweepAudit(), day).unref()
  const sweepAttempts = async () => {
    try {
      await deleteStaleLoginAttempts(getDb())
    } catch (e) {
      console.error(
        'login attempt cleanup failed',
        e instanceof Error ? e.message : e,
      )
    }
  }
  void sweepAttempts()
  setInterval(() => void sweepAttempts(), quarterHour).unref()
})

import { definePlugin } from 'nitro'
import { getDb } from './db.server'
import { deleteEndedSessions } from './session.server'

const day = 24 * 60 * 60 * 1000

// Runs once when the server starts; the build's prerender starts it too, with no secrets or database.
export default definePlugin(() => {
  if (process.env.TSS_PRERENDERING) return
  if (process.env.NODE_ENV === 'production' && !process.env.PII_HASH_KEY)
    throw new Error('PII_HASH_KEY is not set')
  const sweep = () =>
    deleteEndedSessions(getDb()).catch((e: unknown) => {
      console.error(
        'session cleanup failed',
        e instanceof Error ? e.message : e,
      )
    })
  void sweep()
  setInterval(() => void sweep(), day).unref()
})

import { Kysely, PostgresDialect } from 'kysely'
import type { Transaction } from 'kysely'
import pg from 'pg'
import type { DB } from './db.gen'
import { addDbTime, log } from './log.server'

// Reports its query time to the request's summary line and each transaction as a step line.
export function createDb(connectionString: string) {
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
    log: (event) => {
      if (event.level === 'query') addDbTime(event.queryDurationMillis)
    },
  })
  const transaction = db.transaction.bind(db)
  db.transaction = () => {
    const builder = transaction()
    const execute = builder.execute.bind(builder)
    builder.execute = async <T>(run: (trx: Transaction<DB>) => Promise<T>) => {
      const started = performance.now()
      let outcome = 'rolled_back'
      try {
        const value = await execute(run)
        outcome = 'committed'
        return value
      } finally {
        log('info', 'transaction', {
          outcome,
          duration_ms: Math.round(performance.now() - started),
        })
      }
    }
    return builder
  }
  return db
}

let shared: Kysely<DB> | undefined

// The app's one pool, opened on first use.
export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return (shared ??= createDb(url))
}

import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { DB } from './db.gen'

export function createDb(connectionString: string) {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  })
}

let shared: Kysely<DB> | undefined

// The app's one pool, opened on first use.
export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return (shared ??= createDb(url))
}

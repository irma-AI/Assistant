import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { DB } from './db.gen'

export function createDb(connectionString: string) {
  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
  })
}

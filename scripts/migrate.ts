// Applies the pending migrations in migrations/ to DATABASE_URL.
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import { migrate } from '../src/server/migrate.server.ts'

const db = new Kysely<unknown>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
  }),
})
try {
  for (const name of await migrate(db)) console.log(`applied ${name}`)
} finally {
  await db.destroy()
}

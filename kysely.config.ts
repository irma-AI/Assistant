import { defineConfig } from 'kysely-ctl'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

export default defineConfig({
  kysely: new Kysely<unknown>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  }),
  seeds: { seedFolder: 'seeds' },
})

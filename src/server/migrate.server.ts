import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from 'kysely'
import { Migrator } from 'kysely/migration'
import type { Kysely } from 'kysely'
import type { Migration, MigrationProvider } from 'kysely/migration'

// Plain .sql files, applied in name order. Kysely's migrator runs every pending one
// in a single transaction under an advisory lock, so a failure applies none of them.
export function sqlFileProvider(dir: string): MigrationProvider {
  return {
    async getMigrations() {
      const migrations: Record<string, Migration> = {}
      const files = (await readdir(dir))
        .filter((f) => f.endsWith('.sql'))
        .sort()
      for (const file of files) {
        const text = await readFile(join(dir, file), 'utf8')
        migrations[file.slice(0, -'.sql'.length)] = {
          up: async (db) => {
            await sql.raw(text).execute(db)
          },
        }
      }
      return migrations
    },
  }
}

export async function migrate(db: Kysely<unknown>, dir = 'migrations') {
  const migrator = new Migrator({ db, provider: sqlFileProvider(dir) })
  const { error, results } = await migrator.migrateToLatest()
  if (error)
    throw error instanceof Error
      ? error
      : new Error('migration failed', { cause: error })
  return (results ?? []).map((r) => r.migrationName)
}

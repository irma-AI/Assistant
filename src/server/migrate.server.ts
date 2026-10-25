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

export async function migrate<T>(db: Kysely<T>, dir = 'migrations') {
  const migrator = new Migrator({ db, provider: sqlFileProvider(dir) })
  // Kysely throws when the database has a migration this image lacks, which is what a rollback
  // after a release that added one looks like. With nothing pending, serve on the newer schema.
  const known = await migrator.getMigrations()
  const { rows: has } = await sql<{
    ok: boolean
  }>`select to_regclass('kysely_migration') is not null as ok`.execute(db)
  const { rows } = has[0]?.ok
    ? await sql<{
        name: string
      }>`select name from kysely_migration order by name`.execute(db)
    : { rows: [] }
  const ahead = rows
    .map((r) => r.name)
    .filter((n) => !known.some((m) => m.name === n))
  if (ahead.length && known.every((m) => m.executedAt)) {
    console.warn(JSON.stringify({ event: 'migrations_ahead', names: ahead }))
    return []
  }
  const { error, results } = await migrator.migrateToLatest()
  if (error)
    throw error instanceof Error
      ? error
      : new Error('migration failed', { cause: error })
  return (results ?? []).map((r) => r.migrationName)
}

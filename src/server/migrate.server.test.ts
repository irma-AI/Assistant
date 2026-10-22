import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'
import { afterAll, beforeEach, expect, test } from 'vitest'
import { migrate } from './migrate.server'

// Each test gets a fresh database on the real PostgreSQL that DATABASE_URL points at.
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const dbs: Array<Kysely<unknown>> = []
let db: Kysely<unknown>

beforeEach(async () => {
  const name = `test_${randomUUID().replaceAll('-', '')}`
  await admin.query(`create database ${name}`)
  const url = new URL(process.env.DATABASE_URL ?? '')
  url.pathname = `/${name}`
  db = new Kysely({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: url.href }),
    }),
  })
  dbs.push(db)
})

afterAll(async () => {
  await Promise.all(dbs.map((d) => d.destroy()))
  await admin.end()
})

async function dirWith(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'migrations-'))
  for (const [name, text] of Object.entries(files))
    await writeFile(join(dir, name), text)
  return dir
}

async function tables() {
  const { rows } = await sql<{
    name: string
  }>`select tablename as name from pg_tables where schemaname = 'public' order by 1`.execute(
    db,
  )
  return rows.map((r) => r.name)
}

test('applies pending migrations in name order, several statements per file', async () => {
  const dir = await dirWith({
    '0002_b.sql': 'create table b (id int references a);',
    '0001_a.sql':
      'create table a (id int primary key); insert into a values (1);',
  })
  expect(await migrate(db, dir)).toEqual(['0001_a', '0002_b'])
  expect(await tables()).toEqual([
    'a',
    'b',
    'kysely_migration',
    'kysely_migration_lock',
  ])
  expect(await migrate(db, dir)).toEqual([])
})

test('a failing migration applies none of the pending ones', async () => {
  const dir = await dirWith({
    '0001_a.sql': 'create table a (id int);',
    '0002_broken.sql': 'create tabel b (id int);',
  })
  await expect(migrate(db, dir)).rejects.toThrow(/syntax error/)
  expect(await tables()).not.toContain('a')
})

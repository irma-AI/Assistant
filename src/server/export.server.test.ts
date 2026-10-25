import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { z } from 'zod'
import { recordAudit } from './audit.server'
import { createDb } from './db.server'
import { exportData } from './export.server'
import { migrate } from './migrate.server'
import { hashPnr } from './pii.server'
import { createSession } from './session.server'

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const name = `test_${randomUUID().replaceAll('-', '')}`
const url = new URL(process.env.DATABASE_URL ?? '')
url.pathname = `/${name}`
const db = createDb(url.href)

const exportBody = z.object({
  account: z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.date().or(z.string()),
  }),
  sessions: z.array(z.record(z.string(), z.unknown())),
  audit_events: z.array(z.object({ event: z.string() }).loose()),
  personal_identity_number: z.object({ stored: z.string() }),
})
const parse = (text: string) => exportBody.parse(JSON.parse(text))

const addUser = async (userName: string, pnr: string) =>
  db
    .insertInto('users')
    .values({ name: userName, pnr_hmac: hashPnr(pnr) })
    .returning('id')
    .executeTakeFirstOrThrow()

const ask = (token: string) =>
  exportData(
    new Request('https://api.test/api/v1/me/export', {
      headers: { authorization: `Bearer ${token}` },
    }),
    db,
  )

let anna: string
let erik: string
let annaToken: string
let erikToken: string

beforeAll(async () => {
  await admin.query(`create database ${name}`)
  await migrate(db)
  anna = (await addUser('Anna Andersson', '199001012387')).id
  erik = (await addUser('Erik Eriksson', '198512121212')).id
  annaToken = await createSession(db, anna, 'web')
  erikToken = await createSession(db, erik, 'app')
  await recordAudit(db, {
    event: 'login_success',
    userId: anna,
    ip: '203.0.113.7',
  })
  await recordAudit(db, {
    event: 'login_success',
    userId: erik,
    ip: '198.51.100.9',
  })
})

afterAll(async () => {
  await db.destroy()
  await admin.query(`drop database ${name}`)
  await admin.end()
})

test('the export holds every field records.md lists for the user, and no token or hash value', async () => {
  const response = await ask(annaToken)
  expect(response.status).toBe(200)
  expect(response.headers.get('content-disposition')).toContain('attachment')
  const text = await response.text()
  const body = parse(text)
  expect(body.account).toMatchObject({ id: anna, name: 'Anna Andersson' })
  expect(body.account.created_at).toBeTruthy()
  expect(body.sessions).toHaveLength(1)
  expect(Object.keys(body.sessions[0] ?? {}).sort()).toEqual(
    ['created_at', 'expires_at', 'kind', 'last_used_at', 'revoked_at'].sort(),
  )
  expect(body.sessions[0]?.kind).toBe('web')
  expect(body.audit_events[0]).toMatchObject({
    event: 'login_success',
    ip: '203.0.113.0',
    session_kind: null,
  })
  expect(body.personal_identity_number.stored).toMatch(/nyckelad hash/)
  expect(text).not.toContain(annaToken)
  expect(text).not.toContain(hashPnr('199001012387').toString('hex'))
  expect(text).not.toContain(hashPnr('199001012387').toString('base64'))
  expect(text).not.toContain('199001012387')
})

test("another user's session gets only its own data", async () => {
  const text = await (await ask(erikToken)).text()
  const body = parse(text)
  expect(body.account.id).toBe(erik)
  expect(body.sessions).toHaveLength(1)
  expect(body.sessions[0]?.kind).toBe('app')
  expect(text).not.toContain('Anna')
  expect(text).not.toContain(anna)
  expect(text).not.toContain('203.0.113')
})

test('an export is itself recorded, and appears in the next one', async () => {
  const body = parse(await (await ask(annaToken)).text())
  expect(body.audit_events.map((e) => e.event)).toContain('data_exported')
})

test('no session means 401', async () => {
  const response = await exportData(
    new Request('https://api.test/api/v1/me/export'),
    db,
  )
  expect(response.status).toBe(401)
})

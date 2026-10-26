import { createHash } from 'node:crypto'
import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sql } from 'kysely'
import { beforeAll, expect, test } from 'vitest'
import { z } from 'zod'
import { documentsApi } from './documents.api.server'
import { sniff } from './documents.server'
import {
  addMember,
  db,
  idOf,
  newOrg,
  person,
  useDatabase,
} from './orgs.fixture'
import type { Person } from './orgs.fixture'

useDatabase()
beforeAll(async () => {
  process.env.STORAGE_DIR = await mkdtemp(join(tmpdir(), 'docs-'))
})

const pdf = new TextEncoder().encode('%PDF-1.7 made-up receipt')
const png = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)
const heic = new TextEncoder().encode('\0\0\0\x18ftypheic\0\0\0\0')
const jpeg = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0)

const upload = (
  p: Person | undefined,
  org: string,
  body: Uint8Array<ArrayBuffer>,
  name = 'kvitto.pdf',
) =>
  documentsApi.upload(
    new Request(`https://api.test/api/v1/x?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: p ? { authorization: `Bearer ${p.token}` } : {},
      body: new Blob([body]),
    }),
    org,
    db,
  )
const get = (p: Person, org: string, id?: string) => {
  const r = new Request('https://api.test/api/v1/x', {
    headers: { authorization: `Bearer ${p.token}` },
  })
  return id
    ? documentsApi.download(r, org, id, db)
    : documentsApi.list(r, org, db)
}

test('the type comes from the content', () => {
  expect([pdf, png, heic, jpeg].map(sniff)).toEqual([
    'application/pdf',
    'image/png',
    'image/heic',
    'image/jpeg',
  ])
  expect(sniff(new TextEncoder().encode('<script>'))).toBeUndefined()
})

test('an upload keeps the original bytes and a hash, and downloads identically', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const res = await upload(owner, org, pdf)
  expect(res.status).toBe(201)
  const doc = z
    .object({ id: z.string(), sha256: z.string(), content_type: z.string() })
    .parse(await res.json())
  expect(doc.sha256).toBe(createHash('sha256').update(pdf).digest('hex'))
  expect(doc.content_type).toBe('application/pdf')

  const down = await get(owner, org, doc.id)
  expect(new Uint8Array(await down.arrayBuffer())).toEqual(pdf)
  expect(down.headers.get('content-disposition')).toContain('attachment')
  expect(await readdir(join(process.env.STORAGE_DIR ?? '', org))).toEqual([
    doc.id,
  ])
})

test('only PDF, JPEG, PNG and HEIC up to 20 MB, whatever the name says', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const script = new TextEncoder().encode('<script>alert(1)</script>')
  expect((await upload(owner, org, script, 'x.pdf')).status).toBe(415)
  expect((await upload(owner, org, new Uint8Array(0))).status).toBe(400)
  expect(
    (await upload(owner, org, new Uint8Array(20 * 1024 * 1024 + 1))).status,
  ).toBe(413)
  expect((await upload(owner, org, heic, 'IMG_1.HEIC')).status).toBe(201)
})

test('a document belongs to one organisation; members read, only documents.manage uploads', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const member = await person()
  await addMember(owner, org, member, 'Medlem')
  const stranger = await person()
  const other = (await newOrg(stranger)).id
  const { id } = await idOf(await upload(owner, org, pdf))

  expect((await get(member, org, id)).status).toBe(200)
  expect((await upload(member, org, pdf)).status).toBe(403)
  expect((await upload(undefined, org, pdf)).status).toBe(401)
  // A non-member learns nothing, and the id does not open under another organisation.
  expect((await get(stranger, org, id)).status).toBe(404)
  expect((await get(stranger, org)).status).toBe(404)
  expect((await get(stranger, other, id)).status).toBe(404)
  expect(
    z.array(z.unknown()).parse(await (await get(stranger, other)).json()),
  ).toEqual([])
})

test('content is immutable; a linked document cannot change or be deleted before its retention date', async () => {
  const owner = await person()
  const org = (await newOrg(owner)).id
  const { id } = await idOf(await upload(owner, org, pdf))

  await expect(
    sql`update documents set sha256 = repeat('0', 64) where id = ${id}`.execute(
      db,
    ),
  ).rejects.toThrow(/immutable/)
  await expect(
    sql`update documents set retain_until = '2999-12-31' where id = ${id}`.execute(
      db,
    ),
  ).resolves.toBeDefined()
  await expect(
    sql`update documents set retain_until = null where id = ${id}`.execute(db),
  ).rejects.toThrow(/linked and immutable/)
  await expect(
    sql`delete from documents where id = ${id}`.execute(db),
  ).rejects.toThrow(/retained until/)

  // A past retention date releases the delete.
  const old = await idOf(await upload(owner, org, pdf))
  await sql`update documents set retain_until = '2000-01-01' where id = ${old.id}`.execute(
    db,
  )
  await expect(
    sql`delete from documents where id = ${old.id}`.execute(db),
  ).resolves.toBeDefined()
})

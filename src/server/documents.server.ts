import { createHash, randomUUID } from 'node:crypto'
import type { Kysely } from 'kysely'
import type { Audit } from './access.server'
import { access, audited, HttpError, require } from './access.server'
import type { DB } from './db.gen'
import { storage } from './storage.server'
import { inOrganisation } from './tenant.server'

export const maxBytes = 20 * 1024 * 1024

const starts = (b: Uint8Array, at: number, text: string) =>
  Buffer.from(text, 'latin1').every((c, i) => b[at + i] === c)

// The type comes from the content, never the filename or the client's header.
export function sniff(b: Uint8Array) {
  if (starts(b, 0, '%PDF-')) return 'application/pdf'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (starts(b, 1, 'PNG\r\n')) return b[0] === 0x89 ? 'image/png' : undefined
  // HEIC/HEIF: an ISO box `ftyp` at byte 4 with a heic-family brand.
  if (
    starts(b, 4, 'ftyp') &&
    ['heic', 'heix', 'hevc', 'mif1', 'msf1'].some((brand) =>
      starts(b, 8, brand),
    )
  )
    return 'image/heic'
}

const columns = [
  'id',
  'name',
  'content_type',
  'size_bytes',
  'sha256',
  'retain_until',
  'created_at',
] as const

// Every member may read; documents.manage is needed to upload.
export const listDocuments = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    return trx
      .selectFrom('documents')
      .select(columns)
      .where('organisation_id', '=', orgId)
      .orderBy('created_at', 'desc')
      .execute()
  })

// The bytes are written last, inside the transaction: if the file can't be written, the row rolls back with it.
export async function storeDocument(
  trx: Kysely<DB>,
  orgId: string,
  name: string,
  bytes: Uint8Array,
  base: Audit,
) {
  if (!bytes.length || !name || name.length > 255)
    throw new HttpError(400, 'bad_request', false)
  if (bytes.length > maxBytes) throw new HttpError(413, 'too_large', false)
  const type = sniff(bytes)
  if (!type) throw new HttpError(415, 'unsupported_type', false)
  const id = randomUUID()
  const row = await trx
    .insertInto('documents')
    .values({
      id,
      organisation_id: orgId,
      name,
      content_type: type,
      size_bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      storage_key: `${orgId}/${id}`,
    })
    .returning(columns)
    .executeTakeFirstOrThrow()
  await audited(trx, 'document_uploaded', base, orgId, { document: id })
  await storage.put(`${orgId}/${id}`, bytes)
  return row
}

export const uploadDocument = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  name: string,
  bytes: Uint8Array,
  base: Audit,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await require(trx, userId, orgId, 'documents.manage')
    return storeDocument(trx, orgId, name, bytes, base)
  })

export const openDocument = (
  db: Kysely<DB>,
  userId: string,
  orgId: string,
  id: string,
) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const doc = await trx
      .selectFrom('documents')
      .select(['name', 'content_type', 'size_bytes', 'storage_key'])
      .where('id', '=', id)
      .where('organisation_id', '=', orgId)
      .executeTakeFirst()
    if (!doc) throw new HttpError(404, 'not_found')
    return { ...doc, bytes: await storage.get(doc.storage_key) }
  })

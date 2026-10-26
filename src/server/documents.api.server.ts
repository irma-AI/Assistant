import type { Kysely } from 'kysely'
import { HttpError } from './access.server'
import type { DB } from './db.gen'
import * as documents from './documents.server'
import { handle, json } from './orgs.api.server'

// Reads the body but gives up at the cap, so a chunked upload without Content-Length is never buffered whole.
export async function readCapped(request: Request, max: number) {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request.body ?? []) {
    size += chunk.length
    if (size > max) throw new HttpError(413, 'too_large', false)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export const documentsApi = {
  list: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await documents.listDocuments(c.db, c.userId, orgId)),
      db,
    ),
  // The body is the file itself; the name comes in `?name=`.
  upload: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => {
        // Refuse before reading when the client declares too much; the check on the bytes stays.
        if (Number(request.headers.get('content-length')) > documents.maxBytes)
          throw new HttpError(413, 'too_large', false)
        const name = new URL(request.url).searchParams.get('name') ?? ''
        const bytes = await readCapped(request, documents.maxBytes)
        return json(
          await documents.uploadDocument(
            c.db,
            c.userId,
            orgId,
            name,
            bytes,
            c.base,
          ),
          201,
        )
      },
      db,
    ),
  // Served after the permission check, never a public URL. Always a download, with the stored type.
  download: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        const doc = await documents.openDocument(c.db, c.userId, orgId, id)
        return new Response(doc.bytes, {
          headers: {
            'content-type': doc.content_type,
            'content-length': String(doc.size_bytes),
            'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
            'x-content-type-options': 'nosniff',
            'cache-control': 'private, no-store',
          },
        })
      },
      db,
    ),
}

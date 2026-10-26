import type { Kysely } from 'kysely'
import { z } from 'zod'
import { emailToken, newEmail, preferenceChange } from '#/api/schemas'
import { HttpError, refuseDemo } from './access.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import { sendMail } from './email.server'
import type { Send } from './email.server'
import * as notifications from './notifications.server'
import { handle, json, parse } from './orgs.api.server'

const noContent = () => new Response(null, { status: 204 })

export const notificationsApi = {
  list: (request: Request, orgId: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId],
      async (c) => json(await notifications.listNotices(c.db, c.userId, orgId)),
      db,
    ),
  read: (request: Request, orgId: string, id: string, db?: Kysely<DB>) =>
    handle(
      request,
      [orgId, id],
      async (c) => {
        await notifications.markRead(c.db, c.userId, orgId, id)
        return noContent()
      },
      db,
    ),
  preferences: (request: Request, db?: Kysely<DB>) =>
    handle(
      request,
      [],
      async (c) => json(await notifications.listPreferences(c.db, c.userId)),
      db,
    ),
  setPreference: (request: Request, type: string, db?: Kysely<DB>) =>
    handle(
      request,
      [],
      async (c) => {
        const { email } = await parse(request, preferenceChange)
        await notifications.setPreference(c.db, c.userId, type, email)
        return noContent()
      },
      db,
    ),
  email: (request: Request, db?: Kysely<DB>) =>
    handle(
      request,
      [],
      async (c) => json(await notifications.getEmail(c.db, c.userId)),
      db,
    ),
  setEmail: (request: Request, db?: Kysely<DB>, send: Send = sendMail) =>
    handle(
      request,
      [],
      async (c) => {
        refuseDemo(c.kind)
        const { email } = await parse(request, newEmail)
        await notifications.setEmail(c.db, c.userId, email, send)
        return noContent()
      },
      db,
    ),
  confirmEmail: (request: Request, db?: Kysely<DB>) =>
    handle(
      request,
      [],
      async (c) => {
        const { token } = await parse(request, emailToken)
        await notifications.confirmEmail(c.db, c.userId, token)
        return noContent()
      },
      db,
    ),
}

const unsubscribeQuery = z.object({
  user: z.uuid(),
  type: z.string().max(50),
  sig: z.string().max(100),
})

// Reached from the link in an email, with no session: the signed link is the proof. A mail provider's one-click
// unsubscribe sends the same address as a POST.
export async function unsubscribe(request: Request, db: Kysely<DB> = getDb()) {
  const query = unsubscribeQuery.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  const html = (text: string, status: number) =>
    new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aviseringar</title><p>${text}</p>`,
      {
        status,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      },
    )
  try {
    if (!query.success) throw new HttpError(400, 'invalid_link', false)
    await notifications.unsubscribe(
      db,
      query.data.user,
      query.data.type,
      query.data.sig,
    )
  } catch (e) {
    if (!(e instanceof HttpError)) throw e
    return html(
      'Länken fungerar inte. Du kan stänga av mejl under Inställningar i appen.',
      400,
    )
  }
  return html(
    'Klart. Du får inte längre mejl om det här. Du kan slå på dem igen under Inställningar i appen.',
    200,
  )
}

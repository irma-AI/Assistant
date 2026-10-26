import { createHash } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { DB } from './db.gen'
import { sniff } from './documents.server'
import { addReceipt } from './receipts.server'
import { inOrganisation } from './tenant.server'

const codeIn = /\+([0-9a-f]{24})@/i

// The text of a mail is context for a person, never instructions: it is stored as plain text and cut.
const contextOf = (text: string | false | undefined) =>
  text ? text.trim().slice(0, 5000) || null : null

// One received message: every attachment becomes a receipt in the organisation its address names.
// An unknown code, or no code, is dropped. Idempotent: an attachment already stored from mail is skipped.
export async function ingestMessage(db: Kysely<DB>, raw: Buffer) {
  const mail = await simpleParser(raw)
  const to = [mail.to ?? [], mail.cc ?? []]
    .flat()
    .flatMap((a) => a.value.map((v) => v.address ?? ''))
  const code = to.map((a) => codeIn.exec(a)?.[1]?.toLowerCase()).find(Boolean)
  if (!code) return { stored: 0, dropped: true }
  const { rows } = await sql<{ id: string | null }>`
    select organisation_for_inbox(${code}) as id`.execute(db)
  const orgId = rows[0]?.id
  if (!orgId) return { stored: 0, dropped: true }
  let stored = 0
  for (const a of mail.attachments) {
    if (!sniff(a.content)) continue
    const sha = createHash('sha256').update(a.content).digest('hex')
    const added = await inOrganisation(db, orgId, async (trx) => {
      const seen = await trx
        .selectFrom('documents')
        .innerJoin('receipts', 'receipts.document_id', 'documents.id')
        .select('documents.id')
        .where('documents.organisation_id', '=', orgId)
        .where('documents.sha256', '=', sha)
        .where('receipts.source', '=', 'email')
        .executeTakeFirst()
      if (seen) return false
      await addReceipt(
        trx,
        orgId,
        (a.filename ?? 'kvitto').slice(0, 255),
        a.content,
        'email',
        {},
        contextOf(mail.text),
      )
      return true
    })
    if (added) stored++
  }
  return { stored, dropped: false }
}

// Reads every unread message from the mailbox and marks it read once it is handled.
// RECEIPT_IMAP_URL (imaps://user:password@host:993) is read here; unset, the job does nothing.
export async function fetchReceiptMail(db: Kysely<DB>) {
  const url = process.env.RECEIPT_IMAP_URL
  if (!url) return
  const u = new URL(url)
  const client = new ImapFlow({
    host: u.hostname,
    port: Number(u.port || 993),
    secure: u.protocol === 'imaps:',
    auth: {
      user: decodeURIComponent(u.username),
      pass: decodeURIComponent(u.password),
    },
    logger: false,
  })
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const uids = await client.search({ seen: false }, { uid: true })
      for (const uid of uids || []) {
        const msg = await client.fetchOne(
          String(uid),
          { source: true },
          { uid: true },
        )
        if (!msg || !msg.source) continue
        await ingestMessage(db, msg.source)
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout()
  }
}

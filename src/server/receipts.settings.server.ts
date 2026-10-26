import { randomBytes } from 'node:crypto'
import type { Kysely } from 'kysely'
import { access } from './access.server'
import type { DB } from './db.gen'
import { inOrganisation } from './tenant.server'

type Trx = Kysely<DB>

export const settingsOf = async (trx: Trx, orgId: string) => {
  await trx
    .insertInto('receipt_settings')
    .values({
      organisation_id: orgId,
      inbox_code: randomBytes(12).toString('hex'),
    })
    .onConflict((oc) => oc.column('organisation_id').doNothing())
    .execute()
  return trx
    .selectFrom('receipt_settings')
    .select(['suggestions', 'inbox_code'])
    .where('organisation_id', '=', orgId)
    .executeTakeFirstOrThrow()
}

export const getSettings = (db: Kysely<DB>, userId: string, orgId: string) =>
  inOrganisation(db, orgId, async (trx) => {
    await access(trx, userId, orgId)
    const s = await settingsOf(trx, orgId)
    const domain = process.env.RECEIPT_MAIL_ADDRESS ?? ''
    // The address is `kvitto+<code>@host`: the code goes after the plus of the mailbox's own address.
    const [local, host] = domain.split('@')
    return {
      suggestions: s.suggestions,
      inbox: local && host ? `${local}+${s.inbox_code}@${host}` : null,
    }
  })

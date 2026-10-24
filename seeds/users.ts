import type { Kysely } from 'kysely'
import type { DB } from '../src/server/db.gen.ts'
import { hmacPnr } from '../src/server/pii.server.ts'
import { makePeople } from './people.ts'

// A fixed key for development only; production's PII_HASH_KEY is a Dokploy secret.
export const devKey = 'dev-only-pii-hash-key'

export async function seed(db: Kysely<DB>): Promise<void> {
  const users = makePeople(5).map((p) => ({
    name: `${p.firstName} ${p.lastName}`,
    pnr_hmac: hmacPnr(p.personalIdentityNumber, devKey),
  }))
  await db
    .insertInto('users')
    .values(users)
    .onConflict((oc) => oc.column('pnr_hmac').doNothing())
    .execute()
}

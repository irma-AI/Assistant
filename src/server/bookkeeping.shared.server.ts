import type { Transaction } from 'kysely'
import { HttpError, require } from './access.server'
import type { DB } from './db.gen'

export type Trx = Transaction<DB>

export const code = (e: unknown) =>
  typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined
const message = (e: unknown) => (e instanceof Error ? e.message : '')

// The database enforces the law (docs/bookkeeping-foundations.md); this puts its refusals into the API's codes.
// The balance check runs at commit, so the mapping wraps the whole transaction.
const refusals: [string, string | undefined, HttpError][] = [
  ['23P01', undefined, new HttpError(409, 'fiscal_year_overlap')],
  ['23505', undefined, new HttpError(409, 'conflict')],
  ['23001', 'locked', new HttpError(409, 'period_locked')],
  ['23514', 'not balanced', new HttpError(422, 'unbalanced')],
  [
    '23514',
    'outside its fiscal year',
    new HttpError(422, 'outside_fiscal_year'),
  ],
  ['23514', 'exceed', new HttpError(422, 'credit_exceeds')],
  ['23514', 'no amount', new HttpError(422, 'no_amount')],
  ['23514', undefined, new HttpError(400, 'bad_request', false)],
]

export async function mapped<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (e) {
    const hit = refusals.find(
      ([c, m]) => code(e) === c && (m === undefined || message(e).includes(m)),
    )
    throw hit?.[2] ?? e
  }
}

// Who, what and with which version of the app (BFL 5 kap. 11 §). Kept like the books themselves.
export async function actor(trx: Trx, userId: string) {
  const u = await trx
    .selectFrom('users')
    .select('name')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()
  return { id: userId, name: u.name, version: process.env.APP_VERSION ?? 'dev' }
}
export type Actor = Awaited<ReturnType<typeof actor>>

export const history = (
  trx: Trx,
  orgId: string,
  who: Actor,
  event: string,
  detail: Record<string, string | number | boolean>,
  voucherId?: string,
) =>
  trx
    .insertInto('bookkeeping_history')
    .values({
      organisation_id: orgId,
      event,
      voucher_id: voucherId,
      user_id: who.id,
      user_name: who.name,
      app_version: who.version,
      detail: JSON.stringify(detail),
    })
    .execute()

export const manage = async (trx: Trx, userId: string, orgId: string) => {
  await require(trx, userId, orgId, 'bookkeeping.manage')
  return actor(trx, userId)
}

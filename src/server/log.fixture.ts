import { z } from 'zod'
import { clientErrors } from './clientErrors.api.server'
import { checkBankidConfig } from './auth/bankid.server'
import { cancelLogin } from './login.server'
import { inRequest, job, logShutdown } from './log.server'
import { migrate } from './migrate.server'
import { orgsApi } from './orgs.api.server'
import { addMember, db, newOrg, person, req } from './orgs.fixture'

const line = z.looseObject({
  event: z.string(),
  request_id: z.unknown().optional(),
  calls: z.unknown().optional(),
})

// The JSON lines a spy on process.stdout.write caught.
export const linesOf = (calls: unknown[][]) =>
  calls.map((c) => line.parse(JSON.parse(String(c[0]))))

// Makes the app log one of each event it can produce without a BankID login: a request with a token in its
// path and query, a denial, an unhandled error, a cancelled login, start-up, shutdown, migrations and jobs.
export async function logEveryEvent(loginCookie: string) {
  const rawPath = '/api/v1/invites/tok3n-SECRET'
  const owner = await person()
  const member = await person()
  const org = await newOrg(owner)
  await addMember(owner, org.id, member, 'Medlem')
  const url = `https://app.example${rawPath}`
  await inRequest(
    new Request(`${url}?code=q-SECRET`),
    '/api/v1/invites/:token',
    async () => ({
      response: await orgsApi.remove(
        req(member, 'DELETE'),
        org.id,
        owner.id,
        db,
      ),
    }),
  )
  await inRequest(new Request(url), '/x', async () => ({
    response: await cancelLogin(
      new Request(url, { method: 'POST', headers: { cookie: loginCookie } }),
      db,
    ),
  }))
  await inRequest(new Request(url), '/x', () =>
    Promise.reject(new Error('db down')),
  )
  await clientErrors(
    new Request(url, {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({
        name: 'Error',
        message: 'boom',
        stack: 'Error: boom',
        route: '/x',
        version: 'dev',
      }),
    }),
  )
  checkBankidConfig()
  logShutdown()
  await migrate(db)
  await job('probe', () => Promise.resolve())
  await job('broken', () => Promise.reject(new Error('boom'))).catch(
    () => undefined,
  )
}

import { expect, test, vi } from 'vitest'
import { cancelLogin } from './login.server'
import { orgsApi } from './orgs.api.server'
import { linesOf } from './log.fixture'
import { inRequest } from './log.server'
import {
  addMember,
  change,
  db,
  newOrg,
  person,
  req,
  roleId,
  useDatabase,
} from './orgs.fixture'

useDatabase()

// Runs one request through the log wrapper and returns its response with every line it wrote.
async function logged(
  route: string,
  request: Request,
  run: () => Promise<Response>,
) {
  const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const result = await inRequest(request, route, async () => ({
    response: await run(),
  }))
  const lines = linesOf(out.mock.calls)
  out.mockRestore()
  const response = 'response' in result ? result.response : result
  return {
    response,
    lines,
    summary: lines.filter((l) => l.event === 'request'),
  }
}

test('one summary line per request holds every field, and x-request-id matches its request_id', async () => {
  const owner = await person()
  const org = await newOrg(owner)
  const request = req(owner, 'GET')
  const { response, lines, summary } = await logged(
    '/api/v1/orgs/:orgId/roles',
    request,
    () => orgsApi.roles(request, org.id, db),
  )
  expect(response.status).toBe(200)
  expect(summary).toHaveLength(1)
  const line = summary[0]
  expect(line).toBeDefined()
  expect(line).toMatchObject({
    level: 'info',
    event: 'request',
    method: 'GET',
    route: '/api/v1/orgs/:orgId/roles',
    status: 200,
    user_id: owner.id,
    org_id: org.id,
    outcome: 'ok',
  })
  for (const key of ['duration_ms', 'db_ms', 'outside_ms', 'time', 'service'])
    expect(line).toHaveProperty(key)
  expect(line?.calls).toEqual([])
  expect(response.headers.get('x-request-id')).toBe(line?.request_id)
  // the step lines of this request carry the same id
  expect(lines.map((l) => l.event)).toEqual(
    expect.arrayContaining(['session_resolved', 'request']),
  )
  expect(new Set(lines.map((l) => l.request_id))).toEqual(
    new Set([line?.request_id]),
  )
})

test('a write transaction and a permission decision are step lines of the request', async () => {
  const request = req(await person(), 'POST', { name: 'Bolaget AB' })
  const { lines } = await logged('/api/v1/orgs', request, () =>
    orgsApi.create(request, db),
  )
  expect(lines.map((l) => l.event)).toContain('transaction')
  expect(lines.find((l) => l.event === 'transaction')).toMatchObject({
    level: 'info',
    outcome: 'committed',
  })
})

test('a denied request sets outcome on the summary line and writes one access_denied event', async () => {
  const owner = await person()
  const member = await person()
  const org = await newOrg(owner)
  await addMember(owner, org.id, member, 'Medlem')
  const ownerRole = await roleId(owner, org.id, 'Ägare')
  const request = req(member, 'PATCH', { roleId: ownerRole })
  const { response, lines, summary } = await logged(
    '/api/v1/orgs/:orgId/members/:userId',
    request,
    () => change(member, org.id, owner, ownerRole),
  )
  expect(response.status).toBe(403)
  expect(summary[0]).toMatchObject({ status: 403, outcome: 'denied' })
  expect(lines.filter((l) => l.event === 'access_denied')).toHaveLength(1)
  expect(
    lines.filter((l) => l.event === 'permission_decision')[0],
  ).toMatchObject({ permission: 'members.manage', outcome: 'denied' })
})

test('an unhandled error is logged once and the request answers 500 with its id', async () => {
  const { response, lines, summary } = await logged(
    '/api/v1/x',
    new Request('https://api.test/api/v1/x'),
    () => Promise.reject(new Error('db down')),
  )
  const errors = lines.filter((l) => l.level === 'error')
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    event: 'unhandled_error',
    'error.name': 'Error',
    'error.message': 'db down',
  })
  expect(summary[0]).toMatchObject({
    level: 'info',
    status: 500,
    outcome: 'error',
  })
  expect(response.status).toBe(500)
  expect(response.headers.get('x-request-id')).toBe(summary[0]?.request_id)
})

test('a cancelled login is a field on the summary line, with no line of its own', async () => {
  const request = new Request('https://app.example/api/v1/auth/bankid/cancel', {
    method: 'POST',
  })
  const { summary, lines } = await logged(
    '/api/v1/auth/bankid/cancel',
    request,
    () => cancelLogin(request, db),
  )
  expect(summary[0]).toMatchObject({
    outcome: 'cancelled',
    bankid: 'cancelled',
  })
  expect(lines.map((l) => l.event)).toEqual(['request'])
})

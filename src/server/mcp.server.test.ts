import { expect, test } from 'vitest'
import { z } from 'zod'
import { toolNames, mcp } from './mcp.server'
import { db, newOrg, person, useDatabase } from './orgs.fixture'
import type { Person } from './orgs.fixture'
import { createSession } from './session.server'

useDatabase()

const rpc = (p: Person | undefined, method: string, params?: object) =>
  mcp(
    new Request('https://api.test/api/v1/mcp', {
      method: 'POST',
      headers: {
        'user-agent': 'test-client',
        ...(p && { authorization: `Bearer ${p.token}` }),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    db,
  )

const call = (p: Person | undefined, name: string, args: object = {}) =>
  rpc(p, 'tools/call', { name, arguments: args })

const result = z.object({
  result: z.object({
    isError: z.boolean(),
    content: z.array(z.object({ text: z.string() })),
  }),
})
const text = async (r: Response) => {
  const { result: x } = result.parse(await r.json())
  return {
    isError: x.isError,
    value: z.json().parse(JSON.parse(x.content[0]?.text ?? 'null')),
  }
}

test('every tool requires a session', async () => {
  const names = toolNames
  expect(names.length).toBeGreaterThan(0)
  for (const n of names)
    expect(
      (await call(undefined, n, { organisationId: crypto.randomUUID() }))
        .status,
    ).toBe(401)
})

test('lists tools, all read-only', async () => {
  const p = await person()
  const body = z
    .object({
      result: z.object({
        tools: z.array(
          z.object({ annotations: z.object({ readOnlyHint: z.boolean() }) }),
        ),
      }),
    })
    .parse(await (await rpc(p, 'tools/list')).json())
  expect(body.result.tools.length).toBe(toolNames.length)
  expect(body.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true)
})

test('member tools work for members and refuse outsiders, each call audited', async () => {
  const owner = await person()
  const outsider = await person()
  const org = await newOrg(owner)
  const id = org.id

  const mine = await text(await call(owner, 'list_organisations'))
  expect(mine.value).toMatchObject([{ id, role: 'Ägare' }])

  for (const n of ['get_my_access', 'list_roles', 'list_members']) {
    expect(
      (await text(await call(owner, n, { organisationId: id }))).isError,
    ).toBe(false)
    const refused = await text(await call(outsider, n, { organisationId: id }))
    expect(refused.isError).toBe(true)
  }

  const rows = await db
    .selectFrom('audit_events')
    .select(['event', 'detail'])
    .where('event', 'in', ['mcp_tool_called', 'authorization_refused'])
    .execute()
  expect(rows.filter((r) => r.event === 'mcp_tool_called').length).toBe(7)
  expect(rows.some((r) => r.event === 'authorization_refused')).toBe(true)
  expect(rows[0]?.detail).toMatchObject({ client: 'test-client' })
})

test('a demo session can read, and bad arguments are rejected', async () => {
  const u = await person()
  const demo = { id: u.id, token: await createSession(db, u.id, 'demo') }
  expect((await text(await call(demo, 'list_organisations'))).isError).toBe(
    false,
  )
  const bad = await call(u, 'list_roles', { organisationId: 'nope' })
  expect(await bad.json()).toMatchObject({ error: { code: -32602 } })
})

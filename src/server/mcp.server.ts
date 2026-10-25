import type { Kysely } from 'kysely'
import { z } from 'zod'
import { HttpError } from './access.server'
import { clientIp, recordAudit } from './audit.server'
import type { DB } from './db.gen'
import { getDb } from './db.server'
import * as members from './members.server'
import * as orgs from './orgs.server'
import { authenticateSession } from './session.server'

type Ctx = { db: Kysely<DB>; userId: string }

const orgInput = z.object({ organisationId: z.uuid() })

// Read-only tools over the same server code as /api/v1. `permission` is what the tool needs:
// 'session' is any signed-in user, 'member' is membership of the organisation (the server code checks it).
const tool = <T extends z.ZodType>(
  name: string,
  description: string,
  permission: 'session' | 'member',
  input: T,
  run: (c: Ctx, args: z.infer<T>) => Promise<unknown>,
) => ({
  name,
  description,
  permission,
  schema: z.toJSONSchema(input),
  // undefined means the arguments did not match the input schema; otherwise the call to make.
  run: (c: Ctx, raw: unknown) => {
    const args = input.safeParse(raw ?? {})
    return args.success ? () => run(c, args.data) : undefined
  },
})

const tools = [
  tool(
    'list_organisations',
    "The signed-in user's organisations, with their role in each.",
    'session',
    z.object({}),
    (c) => orgs.listOrganisations(c.db, c.userId),
  ),
  tool(
    'get_my_access',
    "The user's role and permissions in one organisation.",
    'member',
    orgInput,
    (c, a) => orgs.myAccess(c.db, c.userId, a.organisationId),
  ),
  tool(
    'list_roles',
    "An organisation's roles and their permissions.",
    'member',
    orgInput,
    (c, a) => orgs.listRoles(c.db, c.userId, a.organisationId),
  ),
  tool(
    'list_members',
    "An organisation's members and their roles.",
    'member',
    orgInput,
    (c, a) => members.listMembers(c.db, c.userId, a.organisationId),
  ),
]

export const toolNames = tools.map((t) => t.name)

const versions = ['2025-06-18', '2025-03-26']

const message = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
})

const reply = (id: string | number | undefined, result: unknown) =>
  Response.json({ jsonrpc: '2.0', id, result })
const fail = (id: string | number | undefined, code: number, text: string) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message: text } })

const textResult = (value: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError,
})

function simple(
  id: string | number,
  method: string,
  params?: Record<string, unknown>,
) {
  if (method === 'ping') return reply(id, {})
  if (method === 'initialize')
    return reply(id, {
      protocolVersion:
        versions.find((v) => v === params?.protocolVersion) ?? versions[0],
      capabilities: { tools: {} },
      serverInfo: { name: 'assistant', version: '1' },
    })
  if (method === 'tools/list')
    return reply(id, {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.schema,
        annotations: { readOnlyHint: true },
      })),
    })
  return undefined
}

async function callTool(
  request: Request,
  db: Kysely<DB>,
  session: { userId: string; kind: string },
  id: string | number,
  params?: Record<string, unknown>,
) {
  const call = z
    .object({ name: z.string(), arguments: z.unknown().optional() })
    .safeParse(params)
  const found = call.success && tools.find((t) => t.name === call.data.name)
  if (!found) return fail(id, -32602, 'unknown tool')
  const start = found.run({ db, userId: session.userId }, call.data.arguments)
  if (!start) return fail(id, -32602, 'invalid arguments')

  // One audit row per call, whatever the outcome; the client is the caller's own User-Agent.
  const audit = (event: 'mcp_tool_called' | 'authorization_refused') =>
    recordAudit(db, {
      userId: session.userId,
      sessionKind: session.kind,
      ip: clientIp(request),
      event,
      detail: {
        tool: found.name,
        client: (request.headers.get('user-agent') ?? 'unknown').slice(0, 100),
      },
    })
  await audit('mcp_tool_called')
  try {
    return reply(id, textResult(await start()))
  } catch (e) {
    if (!(e instanceof HttpError)) throw e
    if (e.refused) await audit('authorization_refused')
    return reply(id, textResult({ error: e.message }, true))
  }
}

// Streamable HTTP, JSON replies only. Auth is the existing session; a demo session may call every tool
// here because they only read.
export async function mcp(request: Request, db: Kysely<DB> = getDb()) {
  const session = await authenticateSession(db, request)
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const msg = message.safeParse(await request.json().catch(() => null))
  if (!msg.success) return fail(undefined, -32600, 'invalid request')
  const { id, method, params } = msg.data
  if (id === undefined) return new Response(null, { status: 202 })
  if (method === 'tools/call') return callTool(request, db, session, id, params)
  return simple(id, method, params) ?? fail(id, -32601, 'method not found')
}

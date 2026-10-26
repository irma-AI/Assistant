import { z } from 'zod'
import { HttpError } from './access.server'
import { clientIp, truncate } from './audit.server'
import { readCapped } from './documents.api.server'
import { cut, log, note } from './log.server'
import { hashNetwork } from './pii.server'

const maxBody = 16 * 1024
const windowMs = 60 * 1000
const limit = () => Number(process.env.CLIENT_ERROR_LIMIT ?? 30)

// Exactly the five fields, nothing else.
const report = z.strictObject({
  name: z.string(),
  message: z.string(),
  stack: z.string(),
  route: z.string(),
  version: z.string(),
})

// shortcut: counts live in this process and reset on restart, so a second instance doubles the limit;
// move to the database when the app runs on more than one instance.
const hits = new Map<string, number[]>()

function tooMany(network: string) {
  const now = Date.now()
  const recent = (hits.get(network) ?? []).filter((t) => t > now - windowMs)
  if (recent.length >= limit()) return true
  hits.set(network, [...recent, now])
  return false
}

export function clearClientErrorLimit() {
  hits.clear()
}

export async function clientErrors(request: Request) {
  const network = truncate(clientIp(request))
  if (!network) return Response.json({ error: 'bad_request' }, { status: 400 })
  if (tooMany(network)) {
    note({ outcome: 'denied' })
    log('warn', 'rate_limited', {
      status: 429,
      limit: 'client_errors',
      key: hashNetwork(network),
    })
    return Response.json({ error: 'too_many_requests' }, { status: 429 })
  }
  let parsed: z.infer<typeof report> | undefined
  try {
    const text = (await readCapped(request, maxBody)).toString()
    const result = report.safeParse(JSON.parse(text))
    if (result.success) parsed = result.data
  } catch (e) {
    if (e instanceof HttpError && e.status === 413)
      return Response.json({ error: 'too_large' }, { status: 413 })
  }
  if (!parsed) return Response.json({ error: 'bad_request' }, { status: 400 })
  log('error', 'client_error', {
    service: 'client',
    msg: 'Error in the browser or app: read the stack, find the route, fix by PR',
    route: cut(parsed.route, 200),
    app_version: cut(parsed.version, 100),
    'error.name': cut(parsed.name, 100),
    'error.message': cut(parsed.message),
    'error.stack': cut(parsed.stack, 2000),
  })
  return new Response(null, { status: 204 })
}

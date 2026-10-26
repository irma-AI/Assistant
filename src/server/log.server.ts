import { AsyncLocalStorage } from 'node:async_hooks'

// The fixed list (docs/observability.md): one name per kind of event.
export const events = [
  'request',
  'session_resolved',
  'permission_decision',
  'outside_call',
  'transaction',
  'startup',
  'shutdown',
  'migrations',
  'migrations_ahead',
  'job',
  'login',
  'access_denied',
  'rate_limited',
  'unhandled_error',
] as const
export type LogEvent = (typeof events)[number]
type Level = 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

type Call = { name: string; result: string; ms: number }
// What one request collects for its summary line.
type Context = {
  requestId: string
  dbMs: number
  calls: Call[]
  fields: Fields
  errored: boolean
}
const store = new AsyncLocalStorage<Context>()

const textLimit = 300
// Outside text (user input, other services' error messages) is cut so a line stays small.
export const cut = (text: string, limit = textLimit) => text.slice(0, limit)

export const requestId = () => store.getStore()?.requestId

export function log(level: Level, event: LogEvent, fields: Fields = {}) {
  const ctx = store.getStore()
  if (level === 'error' && ctx) ctx.errored = true
  process.stdout.write(
    `${JSON.stringify({
      time: new Date().toISOString(),
      level,
      service: process.env.SERVICE_NAME ?? 'app',
      env: process.env.APP_ENV ?? 'dev',
      event,
      request_id: ctx?.requestId,
      ...fields,
    })}\n`,
  )
}

export const errorFields = (e: unknown) => ({
  'error.name': e instanceof Error ? e.name : typeof e,
  'error.message': cut(e instanceof Error ? e.message : String(e)),
  'error.stack': e instanceof Error ? cut(e.stack ?? '', 2000) : undefined,
})

// A field on the request's summary line: user_id, org_id, outcome, or a divergent path such as bankid.
export function note(fields: Fields) {
  const ctx = store.getStore()
  if (ctx) Object.assign(ctx.fields, fields)
}

export function addDbTime(ms: number) {
  const ctx = store.getStore()
  if (ctx) ctx.dbMs += ms
}

// Times a call to another service: a step line, and its name and result on the summary line.
export async function outsideCall<T>(
  name: string,
  run: () => Promise<T>,
  result: (value: T) => string = () => 'ok',
) {
  const started = performance.now()
  let outcome = 'error'
  try {
    const value = await run()
    outcome = result(value)
    return value
  } finally {
    const ms = Math.round(performance.now() - started)
    store.getStore()?.calls.push({ name, result: outcome, ms })
    log('info', 'outside_call', { name, result: outcome, duration_ms: ms })
  }
}

// A job, or work outside a request: one line when it finishes.
export async function job<T>(name: string, run: () => Promise<T>) {
  const started = performance.now()
  const took = () => Math.round(performance.now() - started)
  try {
    const value = await run()
    log('info', 'job', { job: name, outcome: 'ok', duration_ms: took() })
    return value
  } catch (e) {
    log('error', 'job', {
      job: name,
      outcome: 'failed',
      duration_ms: took(),
      msg: `Job ${name} failed: read the error, then the job's last runs`,
      ...errorFields(e),
    })
    throw e
  }
}

// An unhandled error is logged once, here, and the request answers 500 with its id.
export function failRequest(e: unknown) {
  log('error', 'unhandled_error', {
    msg: 'Unhandled error: find the request_id, reproduce, fix by PR',
    ...errorFields(e),
  })
  note({ outcome: 'error' })
}

const outcomeOf = (status: number) =>
  status < 400 ? 'ok' : status < 500 ? 'rejected' : 'error'

// Runs one request inside its context and writes its summary line when it finishes. A thrown Response is
// the framework's way to answer (a redirect); anything else is an unhandled error and answers 500.
export async function inRequest<T extends { response: Response }>(
  request: Request,
  route: string,
  next: () => T | PromiseLike<T>,
): Promise<T | Response> {
  const ctx: Context = {
    requestId: crypto.randomUUID(),
    dbMs: 0,
    calls: [],
    fields: {},
    errored: false,
  }
  return store.run(ctx, async () => {
    const started = performance.now()
    let result: T | undefined
    let response: Response
    try {
      result = await next()
      response = result.response
    } catch (e) {
      if (e instanceof Response) response = e
      else {
        failRequest(e)
        response = Response.json(
          { error: 'internal_error', request_id: ctx.requestId },
          { status: 500 },
        )
      }
    }
    const headers = new Headers(response.headers)
    headers.set('x-request-id', ctx.requestId)
    headers.set('access-control-expose-headers', 'x-request-id')
    // The page's own request id, which the error screen reads; a script cannot see the page's headers otherwise.
    headers.set('server-timing', `request;desc="${ctx.requestId}"`)
    const { status } = response
    log(status >= 500 && !ctx.errored ? 'error' : 'info', 'request', {
      method: request.method,
      route,
      status,
      duration_ms: Math.round(performance.now() - started),
      user_id: null,
      org_id: null,
      outcome: outcomeOf(status),
      db_ms: Math.round(ctx.dbMs),
      outside_ms: ctx.calls.reduce((sum, c) => sum + c.ms, 0),
      calls: ctx.calls.map((c) => ({ name: c.name, result: c.result })),
      ...ctx.fields,
    })
    const answer = new Response(response.body, { status, headers })
    return result ? { ...result, response: answer } : answer
  })
}

export const logShutdown = () => {
  log('info', 'shutdown', { msg: 'Server closing' })
}

import { createMiddleware, createStart } from '@tanstack/react-start'
import { preflight, withCors } from '#/api/cors'
import { csrfBlock } from '#/api/csrf'
import { withNoindex } from '#/api/noindex'
import { inRequest } from '#/server/log.server'
import { routePattern } from './routePattern'

const cors = createMiddleware().server(async ({ next, request }) => {
  const { pathname } = new URL(request.url)
  if (pathname === '/version') return next()
  if (!pathname.startsWith('/api/')) {
    const result = await next()
    return { ...result, response: withNoindex(result.response) }
  }
  const answer = preflight(request)
  if (answer) return answer
  const blocked = csrfBlock(request)
  if (blocked) return withCors(request, blocked)
  const result = await next()
  return { ...result, response: withCors(request, result.response) }
})

// Every request but the deploy's health check gets an id and one summary line.
const requestLog = createMiddleware().server(({ next, request }) => {
  const { pathname } = new URL(request.url)
  if (pathname === '/version') return next()
  return inRequest(request, routePattern(pathname), next)
})

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLog, cors],
}))

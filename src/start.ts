import { createMiddleware, createStart } from '@tanstack/react-start'
import { preflight, withCors } from '#/api/cors'
import { csrfBlock } from '#/api/csrf'
import { withNoindex } from '#/api/noindex'
import { requestLine } from '#/api/requestLog'

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

const requestLog = createMiddleware().server(async ({ next, request }) => {
  if (!new URL(request.url).pathname.startsWith('/api/')) return next()
  const started = performance.now()
  let status = 500
  try {
    const result = await next()
    status = result.response.status
    return result
  } finally {
    console.log(requestLine(request, status, performance.now() - started))
  }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLog, cors],
}))

import { createMiddleware, createStart } from '@tanstack/react-start'
import { preflight, withCors } from '#/api/cors'
import { withNoindex } from '#/api/noindex'

const cors = createMiddleware().server(async ({ next, request }) => {
  const { pathname } = new URL(request.url)
  if (pathname === '/version') return next()
  if (!pathname.startsWith('/api/')) {
    const result = await next()
    return { ...result, response: withNoindex(result.response) }
  }
  const answer = preflight(request)
  if (answer) return answer
  const result = await next()
  return { ...result, response: withCors(request, result.response) }
})

export const startInstance = createStart(() => ({ requestMiddleware: [cors] }))

import { createMiddleware, createStart } from '@tanstack/react-start'
import { preflight, withCors } from '#/api/cors'

const cors = createMiddleware().server(async ({ next, request }) => {
  if (!new URL(request.url).pathname.startsWith('/api/')) return next()
  const answer = preflight(request)
  if (answer) return answer
  const result = await next()
  return { ...result, response: withCors(request, result.response) }
})

export const startInstance = createStart(() => ({ requestMiddleware: [cors] }))

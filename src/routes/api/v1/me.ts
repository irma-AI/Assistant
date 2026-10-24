import { createFileRoute } from '@tanstack/react-router'
import { requireSession } from '#/server/session.server'

export const Route = createFileRoute('/api/v1/me')({
  server: { handlers: { GET: ({ request }) => requireSession(request) } },
})

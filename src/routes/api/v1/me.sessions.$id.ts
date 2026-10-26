import { createFileRoute } from '@tanstack/react-router'
import { endSessions } from '#/server/session.server'

export const Route = createFileRoute('/api/v1/me/sessions/$id')({
  server: {
    handlers: {
      DELETE: ({ request, params }) => endSessions(request, params.id),
    },
  },
})

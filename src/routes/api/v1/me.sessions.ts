import { createFileRoute } from '@tanstack/react-router'
import { endSessions, listSessions } from '#/server/session.server'

export const Route = createFileRoute('/api/v1/me/sessions')({
  server: {
    handlers: {
      GET: ({ request }) => listSessions(request),
      DELETE: ({ request }) => endSessions(request, undefined),
    },
  },
})

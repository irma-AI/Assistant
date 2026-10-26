import { createFileRoute } from '@tanstack/react-router'
import { unsubscribe } from '#/server/notifications.api.server'

export const Route = createFileRoute('/api/v1/notifications/unsubscribe')({
  server: {
    handlers: {
      GET: ({ request }) => unsubscribe(request),
      POST: ({ request }) => unsubscribe(request),
    },
  },
})

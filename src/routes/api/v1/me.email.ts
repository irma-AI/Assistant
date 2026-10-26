import { createFileRoute } from '@tanstack/react-router'
import { notificationsApi } from '#/server/notifications.api.server'

export const Route = createFileRoute('/api/v1/me/email')({
  server: {
    handlers: {
      GET: ({ request }) => notificationsApi.email(request),
      PUT: ({ request }) => notificationsApi.setEmail(request),
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { notificationsApi } from '#/server/notifications.api.server'

export const Route = createFileRoute('/api/v1/me/email/confirm')({
  server: {
    handlers: {
      POST: ({ request }) => notificationsApi.confirmEmail(request),
    },
  },
})

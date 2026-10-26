import { createFileRoute } from '@tanstack/react-router'
import { notificationsApi } from '#/server/notifications.api.server'

export const Route = createFileRoute('/api/v1/me/notifications/$type')({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        notificationsApi.setPreference(request, params.type),
    },
  },
})

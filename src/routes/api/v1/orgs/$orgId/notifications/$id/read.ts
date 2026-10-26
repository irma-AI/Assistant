import { createFileRoute } from '@tanstack/react-router'
import { notificationsApi } from '#/server/notifications.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/notifications/$id/read',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        notificationsApi.read(request, params.orgId, params.id),
    },
  },
})

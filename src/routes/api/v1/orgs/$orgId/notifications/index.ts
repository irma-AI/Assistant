import { createFileRoute } from '@tanstack/react-router'
import { notificationsApi } from '#/server/notifications.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/notifications/')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        notificationsApi.list(request, params.orgId),
    },
  },
})

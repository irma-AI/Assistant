import { createFileRoute } from '@tanstack/react-router'
import { paymentsApi } from '#/server/payments.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/payments/')({
  server: {
    handlers: {
      GET: ({ request, params }) => paymentsApi.list(request, params.orgId),
    },
  },
})

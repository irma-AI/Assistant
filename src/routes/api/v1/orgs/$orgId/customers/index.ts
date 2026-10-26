import { createFileRoute } from '@tanstack/react-router'
import { customersApi } from '#/server/customers.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/customers/')({
  server: {
    handlers: {
      GET: ({ request, params }) => customersApi.list(request, params.orgId),
      POST: ({ request, params }) => customersApi.create(request, params.orgId),
    },
  },
})

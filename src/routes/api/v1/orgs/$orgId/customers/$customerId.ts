import { createFileRoute } from '@tanstack/react-router'
import { customersApi } from '#/server/customers.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/customers/$customerId',
)({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        customersApi.update(request, params.orgId, params.customerId),
      DELETE: ({ request, params }) =>
        customersApi.remove(request, params.orgId, params.customerId),
    },
  },
})

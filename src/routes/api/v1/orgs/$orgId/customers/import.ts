import { createFileRoute } from '@tanstack/react-router'
import { customersApi } from '#/server/customers.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/customers/import')({
  server: {
    handlers: {
      POST: ({ request, params }) => customersApi.import(request, params.orgId),
    },
  },
})

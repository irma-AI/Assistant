import { createFileRoute } from '@tanstack/react-router'
import { invoicesApi } from '#/server/invoices.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/invoices/')({
  server: {
    handlers: {
      GET: ({ request, params }) => invoicesApi.list(request, params.orgId),
      POST: ({ request, params }) => invoicesApi.create(request, params.orgId),
    },
  },
})

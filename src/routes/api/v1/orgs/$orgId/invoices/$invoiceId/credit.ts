import { createFileRoute } from '@tanstack/react-router'
import { invoicesApi } from '#/server/invoices.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/invoices/$invoiceId/credit',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        invoicesApi.credit(request, params.orgId, params.invoiceId),
    },
  },
})

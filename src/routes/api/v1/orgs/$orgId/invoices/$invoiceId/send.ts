import { createFileRoute } from '@tanstack/react-router'
import { invoicesApi } from '#/server/invoices.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/invoices/$invoiceId/send',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        invoicesApi.send(request, params.orgId, params.invoiceId),
    },
  },
})

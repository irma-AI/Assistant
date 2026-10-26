import { createFileRoute } from '@tanstack/react-router'
import { invoicesApi } from '#/server/invoices.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/invoices/$invoiceId/email',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        invoicesApi.email(request, params.orgId, params.invoiceId),
    },
  },
})

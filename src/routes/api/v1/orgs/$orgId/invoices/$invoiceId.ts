import { createFileRoute } from '@tanstack/react-router'
import { invoicesApi } from '#/server/invoices.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/invoices/$invoiceId')(
  {
    server: {
      handlers: {
        GET: ({ request, params }) =>
          invoicesApi.get(request, params.orgId, params.invoiceId),
        PUT: ({ request, params }) =>
          invoicesApi.replaceDraft(request, params.orgId, params.invoiceId),
        DELETE: ({ request, params }) =>
          invoicesApi.deleteDraft(request, params.orgId, params.invoiceId),
      },
    },
  },
)

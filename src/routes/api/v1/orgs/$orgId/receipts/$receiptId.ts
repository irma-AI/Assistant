import { createFileRoute } from '@tanstack/react-router'
import { receiptsApi } from '#/server/receipts.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/receipts/$receiptId')(
  {
    server: {
      handlers: {
        PATCH: ({ request, params }) =>
          receiptsApi.update(request, params.orgId, params.receiptId),
        POST: ({ request, params }) =>
          receiptsApi.link(request, params.orgId, params.receiptId),
      },
    },
  },
)

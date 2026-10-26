import { createFileRoute } from '@tanstack/react-router'
import { receiptsApi } from '#/server/receipts.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/receipts/unmatched')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        receiptsApi.unmatched(request, params.orgId),
    },
  },
})

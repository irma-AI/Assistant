import { createFileRoute } from '@tanstack/react-router'
import { receiptsApi } from '#/server/receipts.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/receipts/')({
  server: {
    handlers: {
      GET: ({ request, params }) => receiptsApi.list(request, params.orgId),
      POST: ({ request, params }) => receiptsApi.upload(request, params.orgId),
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { receiptsApi } from '#/server/receipts.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/receipts/settings')({
  server: {
    handlers: {
      GET: ({ request, params }) => receiptsApi.settings(request, params.orgId),
      PUT: ({ request, params }) =>
        receiptsApi.setSettings(request, params.orgId),
    },
  },
})

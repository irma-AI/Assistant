import { createFileRoute } from '@tanstack/react-router'
import { receiptsApi } from '#/server/receipts.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/receipts/matches/$matchId',
)({
  server: {
    handlers: {
      PUT: ({ request, params }) =>
        receiptsApi.decide(request, params.orgId, params.matchId),
    },
  },
})

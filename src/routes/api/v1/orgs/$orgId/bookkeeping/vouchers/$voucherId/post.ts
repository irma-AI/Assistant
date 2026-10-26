import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/vouchers/$voucherId/post',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        bookkeepingApi.post(request, params.orgId, params.voucherId),
    },
  },
})

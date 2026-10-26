import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/vouchers/',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        bookkeepingApi.vouchers(request, params.orgId),
      POST: ({ request, params }) =>
        bookkeepingApi.createVoucher(request, params.orgId),
    },
  },
})

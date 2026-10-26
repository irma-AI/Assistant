import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/vouchers/$voucherId',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        bookkeepingApi.voucher(request, params.orgId, params.voucherId),
      PUT: ({ request, params }) =>
        bookkeepingApi.replaceDraft(request, params.orgId, params.voucherId),
      DELETE: ({ request, params }) =>
        bookkeepingApi.deleteDraft(request, params.orgId, params.voucherId),
    },
  },
})

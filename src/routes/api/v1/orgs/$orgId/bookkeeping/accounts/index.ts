import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/accounts/',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        bookkeepingApi.accounts(request, params.orgId),
      POST: ({ request, params }) =>
        bookkeepingApi.addAccount(request, params.orgId),
    },
  },
})

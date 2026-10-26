import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/accounts/$number',
)({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        bookkeepingApi.editAccount(request, params.orgId, params.number),
    },
  },
})

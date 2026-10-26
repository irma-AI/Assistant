import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/fiscal-years/$yearId',
)({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        bookkeepingApi.lockYear(request, params.orgId, params.yearId),
    },
  },
})

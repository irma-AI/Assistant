import { createFileRoute } from '@tanstack/react-router'
import { bookkeepingApi } from '#/server/bookkeeping.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bookkeeping/fiscal-years/',
)({
  server: {
    handlers: {
      GET: ({ request, params }) => bookkeepingApi.years(request, params.orgId),
      POST: ({ request, params }) =>
        bookkeepingApi.createYear(request, params.orgId),
    },
  },
})

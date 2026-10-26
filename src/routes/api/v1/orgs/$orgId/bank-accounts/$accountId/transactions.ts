import { createFileRoute } from '@tanstack/react-router'
import { bankApi } from '#/server/bank.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bank-accounts/$accountId/transactions',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        bankApi.transactions(request, params.orgId, params.accountId),
    },
  },
})

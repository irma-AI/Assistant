import { createFileRoute } from '@tanstack/react-router'
import { bankApi } from '#/server/bank.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/bank-accounts/$accountId/imports',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        bankApi.imports(request, params.orgId, params.accountId),
      POST: ({ request, params }) =>
        bankApi.import(request, params.orgId, params.accountId),
    },
  },
})

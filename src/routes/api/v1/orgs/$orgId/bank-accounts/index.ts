import { createFileRoute } from '@tanstack/react-router'
import { bankApi } from '#/server/bank.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/bank-accounts/')({
  server: {
    handlers: {
      GET: ({ request, params }) => bankApi.accounts(request, params.orgId),
      POST: ({ request, params }) =>
        bankApi.createAccount(request, params.orgId),
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { paymentsApi } from '#/server/payments.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/payments/$paymentId')(
  {
    server: {
      handlers: {
        PUT: ({ request, params }) =>
          paymentsApi.decide(request, params.orgId, params.paymentId),
      },
    },
  },
)

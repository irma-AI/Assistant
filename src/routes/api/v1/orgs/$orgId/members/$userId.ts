import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/members/$userId')({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        orgsApi.changeRole(request, params.orgId, params.userId),
      DELETE: ({ request, params }) =>
        orgsApi.remove(request, params.orgId, params.userId),
    },
  },
})

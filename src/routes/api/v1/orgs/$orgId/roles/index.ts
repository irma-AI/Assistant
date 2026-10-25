import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/roles/')({
  server: {
    handlers: {
      GET: ({ request, params }) => orgsApi.roles(request, params.orgId),
      POST: ({ request, params }) => orgsApi.createRole(request, params.orgId),
    },
  },
})

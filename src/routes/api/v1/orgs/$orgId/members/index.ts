import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/members/')({
  server: {
    handlers: {
      GET: ({ request, params }) => orgsApi.members(request, params.orgId),
    },
  },
})

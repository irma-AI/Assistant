import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/members/me')({
  server: {
    handlers: {
      DELETE: ({ request, params }) => orgsApi.leave(request, params.orgId),
    },
  },
})

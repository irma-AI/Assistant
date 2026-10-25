import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/me')({
  server: {
    handlers: {
      GET: ({ request, params }) => orgsApi.me(request, params.orgId),
    },
  },
})

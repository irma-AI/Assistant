import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/invites/')({
  server: {
    handlers: {
      GET: ({ request, params }) => orgsApi.invites(request, params.orgId),
      POST: ({ request, params }) =>
        orgsApi.createInvite(request, params.orgId),
    },
  },
})

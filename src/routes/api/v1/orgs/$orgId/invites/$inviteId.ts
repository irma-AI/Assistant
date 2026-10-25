import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/invites/$inviteId')({
  server: {
    handlers: {
      DELETE: ({ request, params }) =>
        orgsApi.revokeInvite(request, params.orgId, params.inviteId),
    },
  },
})

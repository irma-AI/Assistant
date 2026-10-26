import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/invites/$token/accept')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        orgsApi.acceptInvite(request, params.token),
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { invitePreview } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/invites/$token')({
  server: {
    handlers: {
      GET: ({ params }) => invitePreview(params.token),
    },
  },
})

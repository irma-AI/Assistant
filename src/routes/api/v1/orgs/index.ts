import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/')({
  server: {
    handlers: {
      GET: ({ request }) => orgsApi.list(request),
      POST: ({ request }) => orgsApi.create(request),
    },
  },
})

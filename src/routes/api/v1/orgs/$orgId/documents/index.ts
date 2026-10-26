import { createFileRoute } from '@tanstack/react-router'
import { documentsApi } from '#/server/documents.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/documents/')({
  server: {
    handlers: {
      GET: ({ request, params }) => documentsApi.list(request, params.orgId),
      POST: ({ request, params }) => documentsApi.upload(request, params.orgId),
    },
  },
})

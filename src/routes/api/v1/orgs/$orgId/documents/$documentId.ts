import { createFileRoute } from '@tanstack/react-router'
import { documentsApi } from '#/server/documents.api.server'

export const Route = createFileRoute(
  '/api/v1/orgs/$orgId/documents/$documentId',
)({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        documentsApi.download(request, params.orgId, params.documentId),
    },
  },
})

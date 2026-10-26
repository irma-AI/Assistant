import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/company')({
  server: {
    handlers: {
      GET: ({ request, params }) => orgsApi.company(request, params.orgId),
      PUT: ({ request, params }) => orgsApi.saveCompany(request, params.orgId),
    },
  },
})

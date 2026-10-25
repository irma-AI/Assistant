import { createFileRoute } from '@tanstack/react-router'
import { orgsApi } from '#/server/orgs.api.server'

export const Route = createFileRoute('/api/v1/orgs/$orgId/roles/$roleId')({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        orgsApi.editRole(request, params.orgId, params.roleId),
      DELETE: ({ request, params }) =>
        orgsApi.deleteRole(request, params.orgId, params.roleId),
    },
  },
})

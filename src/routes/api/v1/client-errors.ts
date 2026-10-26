import { createFileRoute } from '@tanstack/react-router'
import { clientErrors } from '#/server/clientErrors.api.server'

export const Route = createFileRoute('/api/v1/client-errors')({
  server: { handlers: { POST: ({ request }) => clientErrors(request) } },
})

import { createFileRoute } from '@tanstack/react-router'
import { logout } from '#/server/session.server'

export const Route = createFileRoute('/api/v1/logout')({
  server: { handlers: { POST: ({ request }) => logout(request) } },
})

import { createFileRoute } from '@tanstack/react-router'
import { start } from '#/server/login.server'

export const Route = createFileRoute('/api/v1/auth/bankid/start')({
  server: { handlers: { POST: ({ request }) => start(request) } },
})

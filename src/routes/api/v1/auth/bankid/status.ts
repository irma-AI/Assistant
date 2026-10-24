import { createFileRoute } from '@tanstack/react-router'
import { pollLogin } from '#/server/login.server'

export const Route = createFileRoute('/api/v1/auth/bankid/status')({
  server: { handlers: { POST: ({ request }) => pollLogin(request) } },
})

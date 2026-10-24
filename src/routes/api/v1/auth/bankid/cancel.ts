import { createFileRoute } from '@tanstack/react-router'
import { cancelLogin } from '#/server/login.server'

export const Route = createFileRoute('/api/v1/auth/bankid/cancel')({
  server: { handlers: { POST: ({ request }) => cancelLogin(request) } },
})

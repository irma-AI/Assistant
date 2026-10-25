import { createFileRoute } from '@tanstack/react-router'
import { extendLogin } from '#/server/login.order.server'

export const Route = createFileRoute('/api/v1/auth/bankid/extend')({
  server: { handlers: { POST: ({ request }) => extendLogin(request) } },
})

import { createFileRoute } from '@tanstack/react-router'
import { demoLogin } from '#/server/demo.server'

export const Route = createFileRoute('/api/v1/auth/demo/')({
  server: { handlers: { POST: ({ request }) => demoLogin(request) } },
})

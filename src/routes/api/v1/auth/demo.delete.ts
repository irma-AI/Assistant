import { createFileRoute } from '@tanstack/react-router'
import { demoDelete } from '#/server/demo.server'

export const Route = createFileRoute('/api/v1/auth/demo/delete')({
  server: { handlers: { POST: ({ request }) => demoDelete(request) } },
})

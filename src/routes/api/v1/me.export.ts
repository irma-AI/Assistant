import { createFileRoute } from '@tanstack/react-router'
import { exportData } from '#/server/export.server'

export const Route = createFileRoute('/api/v1/me/export')({
  server: { handlers: { GET: ({ request }) => exportData(request) } },
})

import { createFileRoute } from '@tanstack/react-router'
import { mcp } from '#/server/mcp.server'

export const Route = createFileRoute('/api/v1/mcp')({
  server: { handlers: { POST: ({ request }) => mcp(request) } },
})

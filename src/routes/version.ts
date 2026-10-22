import { createFileRoute } from '@tanstack/react-router'

// The deploy job polls this until it shows the commit it just shipped.
export const Route = createFileRoute('/version')({
  server: {
    handlers: {
      GET: () => Response.json({ version: process.env.APP_VERSION ?? 'dev' }),
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { bankidMode } from '#/server/auth/bankid.server'

// The login screen shows a banner unless BankID runs in production.
export const Route = createFileRoute('/api/v1/auth/bankid/mode')({
  server: {
    handlers: {
      GET: () => Response.json({ production: bankidMode() === 'production' }),
    },
  },
})

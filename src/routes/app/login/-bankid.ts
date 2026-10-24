import { z } from 'zod'

const reply = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    message: z.string(),
    qr: z.string().optional(),
  }),
  z.object({ status: z.literal('complete') }),
  z.object({ status: z.literal('failed'), message: z.string() }),
  z.object({ status: z.literal('expired') }),
])
export type Poll = z.infer<typeof reply>

export const expiredMessage = 'BankID-ordern har gått ut. Försök igen.'
export const failedMessage = 'Inloggningen kunde inte genomföras. Försök igen.'

const post = (path: string, body: object) =>
  fetch(`/api/v1/auth/bankid/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export async function startLogin(sameDevice: boolean) {
  const response = await post('start', { sameDevice })
  if (!response.ok) throw new Error(failedMessage)
  return z
    .object({
      autoStartToken: z.string().optional(),
      nonce: z.string().optional(),
    })
    .parse(await response.json())
}

export async function poll(nonce?: string): Promise<Poll> {
  const response = await post('status', { nonce })
  // No attempt means the order was cancelled or swept.
  if (response.status === 404) return { status: 'expired' }
  if (!response.ok) return { status: 'failed', message: failedMessage }
  return reply.parse(await response.json())
}

export const cancelLogin = () => post('cancel', {})

export async function isTestMode() {
  const response = await fetch('/api/v1/auth/bankid/mode')
  return !z.object({ production: z.boolean() }).parse(await response.json())
    .production
}

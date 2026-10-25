import { z } from 'zod'

const reply = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('pending'),
    message: z.string(),
    qr: z.string().optional(),
    remaining: z.number().optional(),
  }),
  z.object({ status: z.literal('complete') }),
  z.object({ status: z.literal('failed'), message: z.string() }),
  z.object({ status: z.literal('expired') }),
])
export type Poll = z.infer<typeof reply>

// RFA22, BankID's text for anything that went wrong.
export const failedMessage = 'Något gick fel. Försök igen.'
export const expiredMessage = failedMessage

const post = (path: string, body: object) =>
  fetch(`/api/v1/auth/bankid/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

export type Purpose = 'login' | 'delete'

export async function startLogin(sameDevice: boolean, purpose: Purpose) {
  const response = await post('start', { sameDevice, purpose })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body)
    throw new Error(error.success ? error.data.error : failedMessage)
  }
  return z.object({ autoStartToken: z.string().optional() }).parse(body)
}

export async function poll(nonce?: string): Promise<Poll> {
  const response = await post('status', { nonce })
  // No attempt means the order was cancelled or swept.
  if (response.status === 404) return { status: 'expired' }
  if (!response.ok) return { status: 'failed', message: failedMessage }
  return reply.parse(await response.json())
}

export const cancelLogin = () => post('cancel', {})

// "Mer tid": the server resets the QR display and answers with the seconds now remaining.
export async function extendLogin() {
  const response = await post('extend', {})
  if (!response.ok) throw new Error(failedMessage)
  return z.object({ remaining: z.number() }).parse(await response.json())
    .remaining
}

// BankID's key points for reading the countdown aloud: 5 to 1 minutes, then 50 to 10 seconds.
const keyPoints = [300, 240, 180, 120, 60, 50, 40, 30, 20, 10]

// What a screen reader hears; it changes only at a key point, so a live region speaks just then.
export function countdownAnnouncement(remaining: number) {
  const point = keyPoints.filter((t) => t >= remaining).at(-1) ?? 300
  if (point < 60) return `${String(point)} sekunder kvar`
  const minutes = point / 60
  return `${String(minutes)} ${minutes === 1 ? 'minut' : 'minuter'} kvar`
}

export const countdownText = (remaining: number) =>
  `${String(Math.floor(remaining / 60))}:${String(remaining % 60).padStart(2, '0')}`

export async function isTestMode() {
  const response = await fetch('/api/v1/auth/bankid/mode')
  return !z.object({ production: z.boolean() }).parse(await response.json())
    .production
}

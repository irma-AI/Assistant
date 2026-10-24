import { createHmac } from 'node:crypto'

export const hmacPnr = (pnr: string, key: string) =>
  createHmac('sha256', key).update(pnr).digest()

export function hashPnr(pnr: string) {
  const key = process.env.PII_HASH_KEY
  if (!key) throw new Error('PII_HASH_KEY is not set')
  return hmacPnr(pnr, key)
}

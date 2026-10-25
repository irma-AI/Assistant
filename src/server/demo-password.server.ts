import { argon2, randomBytes, timingSafeEqual } from 'node:crypto'

// OWASP's minimum for Argon2id: 19 MiB, 2 passes, parallelism 1.
const memory = 19456
const passes = 2
const parallelism = 1
const tagLength = 32

const derive = (
  password: string,
  salt: Buffer,
  m: number,
  t: number,
  p: number,
) =>
  new Promise<Buffer>((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: Buffer.from(password),
        nonce: salt,
        parallelism: p,
        tagLength,
        memory: m,
        passes: t,
      },
      (err, key) => {
        if (err) reject(err)
        else resolve(key)
      },
    )
  })

// node:crypto returns only the raw key, so the stored value carries salt and parameters:
// argon2id$m=19456,t=2,p=1$<salt b64>$<key b64>
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, memory, passes, parallelism)
  return `argon2id$m=${String(memory)},t=${String(passes)},p=${String(parallelism)}$${salt.toString('base64')}$${key.toString('base64')}`
}

const stored = /^argon2id\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/

// Compares in constant time. A missing or malformed hash never matches.
export async function verifyPassword(
  password: string,
  hash: string | undefined,
) {
  const m = stored.exec(hash ?? '')
  if (!m) return false
  const [, mem, t, p, salt, key] = m
  const want = Buffer.from(key ?? '', 'base64')
  const got = await derive(
    password,
    Buffer.from(salt ?? '', 'base64'),
    Number(mem),
    Number(t),
    Number(p),
  )
  return want.length === got.length && timingSafeEqual(want, got)
}

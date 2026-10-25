// @types/node 22 predates crypto.argon2 (Node 24.7); drop this file when the types are bumped.
import 'node:crypto'

declare module 'node:crypto' {
  function argon2(
    algorithm: 'argon2id',
    parameters: {
      message: Buffer
      nonce: Buffer
      parallelism: number
      tagLength: number
      memory: number
      passes: number
    },
    callback: (err: Error | null, derivedKey: Buffer) => void,
  ): void
}

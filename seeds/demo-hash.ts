import { hashPassword } from '../src/server/demo-password.server.ts'

// Prints the value for DEMO_PASSWORD_HASH: `DEMO_PASSWORD=... node seeds/demo-hash.ts`.
console.log(await hashPassword(process.env.DEMO_PASSWORD ?? ''))

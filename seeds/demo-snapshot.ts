import { writeFileSync } from 'node:fs'
import { makeDemo } from './demo.ts'

writeFileSync(
  new URL('../src/server/demo-snapshot.json', import.meta.url),
  `${JSON.stringify(makeDemo(), null, 2)}\n`,
)

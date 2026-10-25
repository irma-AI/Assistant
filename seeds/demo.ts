import { Faker, base, en, sv } from '@faker-js/faker'

// The demo organisation for store reviewers (IRM-91). `pnpm exec node seeds/demo.ts` rewrites
// src/server/demo-snapshot.json; the server loads that file and never imports Faker.
export function makeDemo(seed = 91) {
  const faker = new Faker({ locale: [sv, en, base] })
  faker.seed(seed)
  return {
    user: { name: `${faker.person.firstName()} ${faker.person.lastName()}` },
    organisation: { name: faker.company.name() },
  }
}

if (import.meta.main) {
  const { writeFileSync } = await import('node:fs')
  const file = new URL('../src/server/demo-snapshot.json', import.meta.url)
  writeFileSync(file, `${JSON.stringify(makeDemo(), null, 2)}\n`)
}

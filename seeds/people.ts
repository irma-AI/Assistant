import { Faker, base, en, sv } from '@faker-js/faker'
import snapshot from './skatteverket-test-numbers.json' with { type: 'json' }

// kysely-ctl ignores this file when seeding (it exports no `seed`); seed files and tests import it.
export function makePeople(count: number, seed = 1) {
  const faker = new Faker({ locale: [sv, en, base] })
  faker.seed(seed)
  return Array.from({ length: count }, () => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.exampleEmail(),
    // 070-174 06xx is the block PTS reserves for fiction.
    phone: faker.helpers.fromRegExp(/07017406[0-9]{2}/),
    personalIdentityNumber: faker.helpers.arrayElement(snapshot.numbers),
  }))
}

export { snapshot }

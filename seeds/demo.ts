import { makePeople } from './people.ts'

// The demo organisation's people, from the fixed-seed factory. Ids of the organisation and its Ägare are
// constants in src/server/demo.server.ts; `pnpm exec node seeds/demo-snapshot.ts` writes this to
// src/server/demo-snapshot.json, which is all the server loads (Faker never reaches the bundle).
export function makeDemo() {
  const [owner, ...members] = makePeople(4, 91)
  const name = (p: { firstName: string; lastName: string } | undefined) =>
    p ? `${p.firstName} ${p.lastName}` : ''
  return {
    organisation: { name: 'Demobolaget AB' },
    owner: { name: name(owner) },
    members: members.map((p, i) => ({
      // Fixed so the demo can be removed by id; the ff.. prefix keeps them apart from random ids.
      id: `ffffffff-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      name: name(p),
    })),
  }
}

import { z } from 'zod'
import type { permission } from './schemas'

// The one list of event types. `permission` is who may see the notice, and `mandatory` ones can't be turned off by email
// preference (the person needs them to keep the service working). A feature adds its type here and creates events.
export const eventTypes = {
  bank_consent_expiring: {
    permission: 'organisation.manage',
    mandatory: true,
    label: 'Bankkopplingen går snart ut',
  },
  member_joined: {
    permission: 'members.manage',
    mandatory: false,
    label: 'Ny medlem i organisationen',
  },
} as const satisfies Record<
  string,
  { permission: z.infer<typeof permission>; mandatory: boolean; label: string }
>

export type EventType = keyof typeof eventTypes
export const isEventType = (t: string): t is EventType =>
  Object.keys(eventTypes).some((x) => x === t)

const strings = z.record(z.string(), z.string())
const field = (p: unknown, key: string) => {
  const parsed = strings.safeParse(p)
  return (parsed.success && parsed.data[key]) || '…'
}

// Says what happened, what it means and what to do, in plain Swedish (DESIGN.md, Trust).
export function noticeText(type: EventType, payload: unknown) {
  switch (type) {
    case 'bank_consent_expiring':
      return {
        title: `Kopplingen till ${field(payload, 'bank')} går ut ${field(payload, 'date')}`,
        body: `Banken ger bara tillgång under en begränsad tid. Efter det datumet hämtas inga fler transaktioner. Förnya kopplingen före dess.`,
      }
    case 'member_joined':
      return {
        title: `${field(payload, 'name')} har gått med i organisationen`,
        body: 'Personen har den roll som inbjudan gav. Du kan ändra rollen under Medlemmar.',
      }
  }
}

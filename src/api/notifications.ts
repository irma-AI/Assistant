import { z } from 'zod'
import { kr } from './money'
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
  invoice_paid: {
    permission: 'invoices.manage',
    mandatory: false,
    label: 'Faktura betald',
  },
  invoice_part_paid: {
    permission: 'invoices.manage',
    mandatory: false,
    label: 'Faktura delvis betald',
  },
  invoice_overpaid: {
    permission: 'invoices.manage',
    mandatory: false,
    label: 'Faktura överbetald',
  },
  invoice_due_soon: {
    permission: 'invoices.manage',
    mandatory: false,
    label: 'Faktura förfaller i morgon',
  },
  invoice_overdue: {
    permission: 'invoices.manage',
    mandatory: false,
    label: 'Faktura förfallen',
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

const money = (p: unknown, key: string) => {
  const n = Number(field(p, key))
  return Number.isFinite(n) ? kr(n) : '…'
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
    case 'invoice_paid':
      return {
        title: `Faktura ${field(payload, 'number')} är betald`,
        body: `${field(payload, 'customer')} har betalat ${money(payload, 'amount')}. Betalningen är bokförd.`,
      }
    case 'invoice_part_paid':
      return {
        title: `Faktura ${field(payload, 'number')} är delvis betald`,
        body: `${field(payload, 'customer')} har betalat ${money(payload, 'amount')}. ${money(payload, 'left')} återstår.`,
      }
    case 'invoice_overpaid':
      return {
        title: `Faktura ${field(payload, 'number')} är överbetald`,
        body: `${field(payload, 'customer')} har betalat ${money(payload, 'extra')} mer än fakturan. Betala tillbaka beloppet eller behåll det som tillgodo.`,
      }
    case 'invoice_due_soon':
      return {
        title: `Faktura ${field(payload, 'number')} förfaller i morgon`,
        body: `${field(payload, 'customer')} ska betala ${money(payload, 'left')} senast ${field(payload, 'date')}.`,
      }
    case 'invoice_overdue':
      return {
        title: `Faktura ${field(payload, 'number')} är förfallen`,
        body: `${field(payload, 'customer')} skulle ha betalat ${money(payload, 'left')} senast ${field(payload, 'date')}. Kontakta kunden.`,
      }
  }
}

import type { z } from 'zod'
import type { permission } from './schemas'

// Keyed by the permission list, so a new permission can't be added without a label.
export const permissionText: Record<
  z.infer<typeof permission>,
  { label: string; help: string }
> = {
  'organisation.manage': {
    label: 'Hantera organisationen',
    help: 'Ändra organisationens uppgifter.',
  },
  'members.manage': {
    label: 'Hantera medlemmar',
    help: 'Bjuda in medlemmar, byta deras roll och ta bort dem.',
  },
  'roles.manage': {
    label: 'Hantera roller',
    help: 'Skapa, ändra och ta bort roller.',
  },
  'customers.manage': {
    label: 'Hantera kunder',
    help: 'Lägga till, ändra, importera och ta bort kunder. Alla medlemmar kan se kunderna.',
  },
}

const errorText: Record<string, string> = {
  last_owner: 'Organisationen måste ha minst en Ägare.',
  role_in_use:
    'Rollen används av en medlem. Byt medlemmens roll först, ta sedan bort rollen.',
  owner_role_fixed: 'Ägare kan inte ändras eller tas bort.',
  escalation: 'Du kan bara ge behörigheter som du själv har.',
  forbidden: 'Du har inte behörighet till det här.',
  conflict: 'Det finns redan en roll med det namnet.',
  bad_request: 'Uppgifterna är ogiltiga. Kontrollera dem och försök igen.',
  demo_session: 'Det här går inte i demoläget.',
}

// The server's error code in Swedish; anything unknown gets the generic message.
export const swedishError = (code: string | undefined) =>
  (code && errorText[code]) ?? 'Något gick fel. Försök igen.'

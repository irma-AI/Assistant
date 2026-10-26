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
  'documents.manage': {
    label: 'Hantera dokument',
    help: 'Ladda upp kvitton och andra underlag. Alla medlemmar kan se dokumenten.',
  },
  'bank.manage': {
    label: 'Hantera bankkonton',
    help: 'Lägga till bankkonton och importera kontoutdrag. Alla medlemmar kan se transaktionerna.',
  },
  'bookkeeping.manage': {
    label: 'Hantera bokföringen',
    help: 'Skapa räkenskapsår, ändra kontoplanen och skapa, bokföra och korrigera verifikationer. Alla medlemmar kan se bokföringen.',
  },
  'invoices.manage': {
    label: 'Hantera fakturor',
    help: 'Skapa, skicka och kreditera fakturor. Alla medlemmar kan se fakturorna.',
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
  org_number_taken:
    'Organisationsnumret används redan av en annan organisation. Kontakta supporten om det är fel.',
  period_locked: 'Perioden är låst. Välj ett senare datum.',
  outside_fiscal_year: 'Datumet ligger utanför verifikationens räkenskapsår.',
  no_fiscal_year:
    'Det finns inget räkenskapsår för det datumet. Skapa det först.',
  fiscal_year_overlap: 'Räkenskapsåret överlappar ett som redan finns.',
  unknown_account: 'Ett av kontona finns inte eller är inte aktivt.',
  unbalanced:
    'Debet och kredit är inte lika stora. Verifikationen kan inte bokföras.',
  not_draft:
    'Verifikationen är redan bokförd. Korrigera den med en ny verifikation.',
  not_reversible:
    'Verifikationen går inte att korrigera. Den är inte bokförd eller redan korrigerad.',
  customer_missing: 'Kunden finns inte längre. Välj en kund innan du skickar.',
  company_details_missing:
    'Organisationens företagsuppgifter saknas. Fyll i dem under Uppgifter först.',
  buyer_vat_number_required:
    'Omvänd betalningsskyldighet kräver köparens momsregistreringsnummer. Lägg till det på kunden.',
  buyer_email_required: 'Kunden saknar e-postadress för fakturor.',
  not_creditable: 'Bara en skickad faktura går att kreditera.',
  credit_exceeds: 'Kreditfakturorna blir större än den ursprungliga fakturan.',
  no_amount: 'Fakturan har inget belopp att fakturera.',
  invoice_email_failed:
    'Fakturan är skickad men mejlet gick inte iväg. Ladda ner PDF:en eller försök igen om en stund.',
  document_linked: 'Underlaget hör redan till en verifikation.',
  bad_request: 'Uppgifterna är ogiltiga. Kontrollera dem och försök igen.',
  too_large: 'Filen är större än 20 MB.',
  unsupported_type: 'Filen måste vara en PDF, JPEG, PNG eller HEIC.',
  unknown_format:
    'Filen känns inte igen. Använd en camt.053-fil (XML) eller en CSV-export från Handelsbanken, SEB, Swedbank, Nordea eller Lunar.',
  bad_row: 'En rad i filen går inte att läsa. Inget har importerats.',
  demo_session: 'Det här går inte i demoläget.',
  mandatory: 'Den här aviseringen går inte att stänga av.',
  too_many: 'Vi har nyss skickat en länk. Vänta en minut och försök igen.',
  email_failed:
    'Vi kunde inte skicka bekräftelsen just nu. Adressen är sparad, försök igen om en stund.',
  invalid_link: 'Länken fungerar inte längre. Be om en ny under Inställningar.',
}

// The server's error code in Swedish; anything unknown gets the generic message.
export const swedishError = (code: string | undefined) =>
  (code && errorText[code]) ?? 'Något gick fel. Försök igen.'

export const customerFields = [
  'kind',
  'name',
  'address',
  'email',
  'language',
  'org_number',
  'vat_number',
  'contact',
  'payment_terms_days',
] as const

export const customerFieldText: Record<
  (typeof customerFields)[number],
  string
> = {
  kind: 'Typ (företag eller privat)',
  name: 'Namn',
  address: 'Adress',
  email: 'E-post för fakturor',
  language: 'Språk (sv eller en)',
  org_number: 'Organisationsnummer',
  vat_number: 'Momsregistreringsnummer',
  contact: 'Kontaktperson',
  payment_terms_days: 'Betalningsvillkor (dagar)',
}

// Comma or semicolon separated (Swedish Excel writes semicolons), with "quoted, fields" and "" for a quote.
// Throws on an unterminated quote, so a damaged file is refused rather than half read.
export function parseCsv(text: string) {
  const body = text.replace(/^\uFEFF/, '')
  const first = body.split(/\r?\n/, 1)[0] ?? ''
  const sep = first.split(';').length > first.split(',').length ? ';' : ','
  const next = new RegExp(
    String.raw`("(?:[^"]|"")*"|[^${sep}\r\n"]*)(${sep}|\r\n|\n|\r|$)`,
    'y',
  )
  const rows: string[][] = []
  let row: string[] = []
  while (next.lastIndex < body.length) {
    const m = next.exec(body)
    if (!m) throw new Error('bad csv')
    const [, raw = '', end = ''] = m
    row.push(raw.startsWith('"') ? raw.slice(1, -1).replaceAll('""', '"') : raw)
    if (end !== sep) {
      rows.push(row)
      row = []
    }
  }
  if (row.length) rows.push(row)
  return rows.filter((r) => r.some((x) => x.trim()))
}

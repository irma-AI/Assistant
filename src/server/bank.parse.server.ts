import { createHash } from 'node:crypto'
import { HttpError } from './access.server'

// One imported line, before it has an account. Amounts are signed öre, dates YYYY-MM-DD.
export type Line = {
  bankId?: string
  amountOre: number
  bookingDate: string
  valueDate?: string
  counterparty?: string
  reference?: string
}
export type Statement = { format: string; lines: Line[] }

// UTF-8 with or without a BOM, otherwise Windows-1252.
export function decode(bytes: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^\u{FEFF}/u, '')
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

const bad = () => new HttpError(422, 'bad_row', false)

function date(s: string | undefined) {
  if (!s) return undefined
  const m = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(s.trim())
  if (!m) throw bad()
  const iso = m.slice(1, 4).join('-')
  if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso)
    throw bad()
  return iso
}

// Exact decimal arithmetic in strings: a float would turn 0.1 + 0.2 into a different öre.
function ore(s: string | undefined, decimal: ',' | '.') {
  const t = (s ?? '')
    .replace(/\s/gu, '')
    .replace(/[\u2212\u2013]/gu, '-')
    .replace(decimal, '.')
  const m = /^([+-]?)(\d+)(?:\.(\d{1,2}))?$/.exec(t)
  if (!m) throw bad()
  const n = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'))
  return m[1] === '-' ? -n : n
}

function splitRow(line: string, sep: string) {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  let skip = false
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i)
    if (skip) {
      skip = false
    } else if (quoted && c === '"' && line.charAt(i + 1) === '"') {
      cell += c
      skip = true
    } else if (c === '"') {
      quoted = !quoted
    } else if (c === sep && !quoted) {
      cells.push(cell)
      cell = ''
    } else {
      cell += c
    }
  }
  cells.push(cell)
  return cells.map((x) => x.trim())
}

type Row = Record<string, string>
type Csv = {
  format: string
  sep: ',' | ';'
  decimal: ',' | '.'
  // The header cells, lower-cased, that tell this export from the others.
  matches: (h: string[]) => boolean
  line: (r: Row, ore: (s: string | undefined) => number) => Line
}
const has = (h: string[], ...names: string[]) =>
  names.every((n) => h.includes(n))
const text = (s: string | undefined) => s || undefined

// Facts from the issue's format table; a real export is checked before go-live (IRM-142 decision 7).
const csvs: Csv[] = [
  {
    format: 'seb-kontoutdrag',
    sep: ';',
    decimal: ',',
    matches: (h) =>
      has(h, 'verifikationsnummer', 'belopp') &&
      (h.includes('bokföringsdag') || h.includes('bokföringsdatum')),
    line: (r, o) => ({
      bankId: text(r['verifikationsnummer']),
      amountOre: o(r['belopp']),
      bookingDate: date(r['bokföringsdag'] ?? r['bokföringsdatum']) ?? '',
      valueDate: date(r['valutadag']),
      counterparty: text(r['text/mottagare']),
    }),
  },
  {
    format: 'seb-transaktioner',
    sep: ';',
    decimal: '.',
    matches: (h) => has(h, 'bokförd', 'insättningar', 'uttag'),
    line: (r, o) => {
      const inn = r['insättningar'] ? o(r['insättningar']) : 0
      const out = r['uttag'] ? Math.abs(o(r['uttag'])) : 0
      return {
        amountOre: inn - out,
        bookingDate: date(r['bokförd']) ?? '',
        valueDate: date(r['valutadatum']),
        counterparty: text(r['text']),
        reference: text(r['typ']),
      }
    },
  },
  {
    format: 'handelsbanken',
    sep: ';',
    decimal: ',',
    matches: (h) => has(h, 'reskontradatum', 'transaktionsdatum', 'belopp'),
    line: (r, o) => ({
      amountOre: o(r['belopp']),
      bookingDate: date(r['reskontradatum']) ?? '',
      valueDate: date(r['transaktionsdatum']),
      counterparty: text(r['text']),
    }),
  },
  {
    format: 'swedbank',
    sep: ',',
    decimal: '.',
    matches: (h) => has(h, 'radnr', 'clnr', 'bokfdag', 'belopp'),
    line: (r, o) => ({
      amountOre: o(r['belopp']),
      bookingDate: date(r['bokfdag']) ?? '',
      valueDate: date(r['valutadag']),
      counterparty: text(r['referens']),
      reference: text(r['text']),
    }),
  },
  {
    format: 'nordea-avsandare',
    sep: ';',
    decimal: ',',
    matches: (h) => has(h, 'bokföringsdag', 'belopp', 'rubrik'),
    line: (r, o) => {
      const amountOre = o(r['belopp'])
      return {
        amountOre,
        bookingDate: date(r['bokföringsdag']) ?? '',
        counterparty: text(
          (amountOre < 0 ? r['mottagare'] : r['avsändare']) || r['namn'],
        ),
        reference: text(r['rubrik']),
      }
    },
  },
  {
    format: 'nordea-betalare',
    sep: ';',
    decimal: ',',
    matches: (h) => has(h, 'bokföringsdag', 'belopp', 'betalningstyp'),
    line: (r, o) => ({
      amountOre: o(r['belopp']),
      bookingDate: date(r['bokföringsdag']) ?? '',
      valueDate: date(r['värdedag']),
      counterparty: text(r['betalare/mottagare']),
      reference: text(r['meddelande/referens']),
    }),
  },
  {
    format: 'lunar',
    sep: ',',
    decimal: ',',
    matches: (h) =>
      has(h, 'belopp', 'titel', 'datum') || has(h, 'amount', 'title', 'date'),
    line: (r, o) => ({
      bankId: text(
        r['transaction id'] ?? r['transaktions-id'] ?? r['transaktions id'],
      ),
      amountOre: o(r['amount'] ?? r['belopp']),
      bookingDate: date(r['date'] ?? r['datum']) ?? '',
      counterparty: text(r['title'] ?? r['titel']),
    }),
  },
]

function parseCsv(content: string): Statement | undefined {
  const rows = content.split(/\r?\n/)
  // Handelsbanken has a preamble of up to about 15 lines; the header is found, never assumed.
  for (let at = 0; at < Math.min(rows.length, 25); at++) {
    for (const csv of csvs) {
      const header = splitRow(rows[at] ?? '', csv.sep).map((c) =>
        c.toLowerCase(),
      )
      if (!csv.matches(header)) continue
      const lines = rows
        .slice(at + 1)
        .filter((r) => r.trim())
        .map((r) => {
          const cells = splitRow(r, csv.sep)
          const row: Row = {}
          header.forEach((h, i) => (row[h] = cells[i] ?? ''))
          return csv.line(row, (s) => ore(s, csv.decimal))
        })
      return { format: csv.format, lines }
    }
  }
}

// shortcut: camt.053 is read with regular expressions, not an XML parser; fine for the bank-generated files this
// accepts, switch to a parser if a bank sends CDATA or nested Ntry.
const tag = (xml: string, name: string) =>
  new RegExp(
    `<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
  ).exec(xml)?.[1]
const tags = (xml: string, name: string) =>
  [
    ...xml.matchAll(
      new RegExp(
        `<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
        'g',
      ),
    ),
  ].map((m) => m[1] ?? '')
const entities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}
const plain = (s: string | undefined) =>
  s?.replace(/&(amp|lt|gt|quot|apos);/g, (e) => entities[e] ?? e).trim() ||
  undefined

const party = (n: string, credit: boolean) =>
  plain(tag(tag(n, credit ? 'Dbtr' : 'Cdtr') ?? '', 'Nm'))
const day = (n: string, name: string) =>
  date(plain(tag(tag(n, name) ?? '', 'Dt')))

function camtLine(n: string): Line {
  const direction = tag(n, 'CdtDbtInd')?.trim()
  if (direction !== 'CRDT' && direction !== 'DBIT') throw bad()
  const amount = ore(plain(tag(n, 'Amt')), '.')
  return {
    bankId: plain(tag(n, 'AcctSvcrRef') ?? tag(n, 'NtryRef')),
    amountOre: direction === 'CRDT' ? amount : -amount,
    bookingDate: day(n, 'BookgDt') ?? '',
    valueDate: day(n, 'ValDt'),
    counterparty: party(n, direction === 'CRDT'),
    reference: plain(tag(tag(n, 'CdtrRefInf') ?? '', 'Ref') ?? tag(n, 'Ustrd')),
  }
}

function parseCamt(content: string): Statement | undefined {
  if (!/<(?:\w+:)?BkToCstmrStmt\b/.test(content)) return undefined
  return { format: 'camt.053', lines: tags(content, 'Ntry').map(camtLine) }
}

export function parseStatement(bytes: Uint8Array) {
  const content = decode(bytes)
  const statement = parseCamt(content) ?? parseCsv(content)
  if (!statement?.lines.length)
    throw new HttpError(422, 'unknown_format', false)
  return statement
}

// The bank's own ID when the file has one. Otherwise a hash of account, date, amount and reference, plus the
// line's position among identical lines that day, so two equal coffees stay two rows and a re-import stays equal.
export function dedupKeys(accountId: string, lines: Line[]) {
  const seen = new Map<string, number>()
  return lines.map((l) => {
    if (l.bankId) return `id:${l.bankId}`
    const base = [
      accountId,
      l.bookingDate,
      String(l.amountOre),
      l.counterparty ?? '',
      l.reference ?? '',
    ].join('|')
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return `h:${createHash('sha256')
      .update(base + '|' + String(n))
      .digest('hex')}`
  })
}

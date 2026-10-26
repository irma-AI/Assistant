// A small, dependency-free PDF writer for one invoice: A4, the standard Helvetica and Courier fonts (Latin-1, so å, ä
// and ö work), uncompressed. shortcut: characters outside Latin-1 print as "?", and long descriptions are cut at the
// column, not wrapped; upgrade to a PDF library when invoices need logos or a wrapped layout.

import { labels } from './invoicePdf.labels.server'

export type PdfInvoice = {
  kind: 'invoice' | 'credit_note'
  number: number
  ocr: string
  invoice_date: string
  supply_date: string
  due_date: string
  reference: string | null
  credits_number: number | null
  buyer: {
    name: string
    address: string
    org_number: string | null
    vat_number: string | null
    language: 'sv' | 'en'
  }
  seller: {
    legal_name: string
    org_number: string
    vat_number: string
    seat: string
    street: string
    postal_code: string
    city: string
    f_skatt: boolean
    payment_kind: 'bankgiro' | 'plusgiro' | 'iban'
    payment_number: string
    swish: string | null
    contact_email: string | null
    contact_phone: string | null
  }
  lines: {
    description: string
    quantity: number
    unit: string
    unit_price: number
    vat_code: string
    net: number
  }[]
  rates: { vat_code: string; net: number; vat: number }[]
  totals: { net: number; vat: number; total: number }
}

// Whole öre as 1 234,50 (sv) or 1,234.50 (en).
export function money(ore: number, lang: 'sv' | 'en') {
  const [group, point] = lang === 'sv' ? [' ', ','] : [',', '.']
  const abs = Math.abs(ore)
  const whole = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+$)/g, group)
  return `${ore < 0 ? '-' : ''}${whole}${point}${String(abs % 100).padStart(2, '0')}`
}

// Latin-1 is what WinAnsi covers; anything above becomes "?". Parentheses and backslashes are escaped.
const esc = (s: string) =>
  s.replace(/[\u0100-\uffff]/g, '?').replace(/[\\()]/g, (c) => `\\${c}`)

const A4 = { w: 595, h: 842 }
const margin = 50
const font = { regular: 'F1', bold: 'F2', mono: 'F3' }

class Page {
  y = A4.h - 60
  ops: string[] = []
  put(
    x: number,
    y: number,
    size: number,
    s: string,
    f: keyof typeof font = 'regular',
  ) {
    this.ops.push(
      `BT /${font[f]} ${String(size)} Tf ${String(x)} ${String(y)} Td (${esc(s)}) Tj ET`,
    )
  }
  // Courier is 0.6 em wide, so right-aligning needs no font metrics.
  right(xr: number, y: number, size: number, s: string) {
    this.put(xr - s.length * size * 0.6, y, size, s, 'mono')
  }
}

function build(pages: Page[]) {
  const objects: string[] = []
  const add = (body: string) => objects.push(body) // object n is index n-1
  add('<< /Type /Catalog /Pages 2 0 R >>')
  const kids = pages.map((_, i) => `${String(6 + i * 2)} 0 R`).join(' ')
  add(`<< /Type /Pages /Kids [${kids}] /Count ${String(pages.length)} >>`)
  for (const name of ['Helvetica', 'Helvetica-Bold', 'Courier'])
    add(
      `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`,
    )
  for (const [i, p] of pages.entries()) {
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(A4.w)} ${String(A4.h)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${String(7 + i * 2)} 0 R >>`,
    )
    const stream = p.ops.join('\n')
    add(`<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`)
  }
  let out = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const at = out.length
    out += `${String(i + 1)} 0 obj\n${body}\nendobj\n`
    return at
  })
  const xref = out.length
  out += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`
  for (const at of offsets) out += `${String(at).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  // One character per byte, so the offsets above are byte offsets.
  return Buffer.from(out, 'latin1')
}

const rateText = (code: string) => (code === 'rc' ? '0' : code)
const orgNo = (n: string) => n.replace(/^(\d{6})(\d{4})$/, '$1-$2')

type Labels = (typeof labels)['sv']
type Doc = { pages: Page[]; page: Page; y: number }

const col = { qty: 330, price: 410, vat: 450, amount: A4.w - margin }

// Title and the right-hand block: dates and the payment reference.
function head(d: Doc, inv: PdfInvoice, t: Labels) {
  d.page.put(
    margin,
    d.page.y,
    20,
    `${t[inv.kind]} ${String(inv.number)}`,
    'bold',
  )
  const meta: [string, string][] = [
    [t.date, inv.invoice_date],
    [t.supply, inv.supply_date],
    [t.due, inv.due_date],
    [t.ocr, inv.ocr],
  ]
  if (inv.reference) meta.push([t.reference, inv.reference])
  if (inv.credits_number !== null)
    meta.push([t.credits, String(inv.credits_number)])
  let my = d.page.y
  for (const [k, v] of meta) {
    d.page.put(330, my, 9, k)
    d.page.put(430, my, 9, v, 'bold')
    my -= 13
  }
  return my
}

// Seller, then the buyer below it; returns the next free y.
function parties(d: Doc, inv: PdfInvoice, t: Labels, metaBottom: number) {
  const s = inv.seller
  const seller = [
    s.legal_name,
    s.street,
    `${s.postal_code} ${s.city}`,
    `${t.seat}: ${s.seat}`,
    `${t.orgNo}: ${orgNo(s.org_number)}`,
    `${t.vatNo}: ${s.vat_number}`,
    ...(s.f_skatt ? [t.fskatt] : []),
  ]
  let y = d.page.y - 28
  seller.forEach((l, i) => {
    d.page.put(margin, y, 9, l, i === 0 ? 'bold' : 'regular')
    y -= 12
  })
  y = Math.min(y, metaBottom) - 14
  d.page.put(margin, y, 8, t.buyer)
  y -= 13
  const b = inv.buyer
  const buyer = [
    b.name,
    ...b.address.split(/\r?\n/),
    ...(b.org_number ? [`${t.orgNo}: ${b.org_number}`] : []),
    ...(b.vat_number ? [`${t.vatNo}: ${b.vat_number}`] : []),
  ]
  buyer.forEach((l, i) => {
    d.page.put(margin, y, 10, l, i === 0 ? 'bold' : 'regular')
    y -= 13
  })
  return y - 20
}

function tableHeader(d: Doc, t: Labels) {
  d.page.put(margin, d.y, 8, t.description, 'bold')
  d.page.right(col.qty, d.y, 8, t.quantity)
  d.page.right(col.price, d.y, 8, t.price)
  d.page.right(col.vat, d.y, 8, t.vat)
  d.page.right(col.amount, d.y, 8, t.amount)
  d.y -= 14
}

// Starts a new page, with the table header again, when less than `need` points are left above the footer.
function room(d: Doc, t: Labels, need: number) {
  if (d.y > 90 + need) return
  d.page = new Page()
  d.pages.push(d.page)
  d.y = A4.h - 60
  tableHeader(d, t)
}

function table(d: Doc, inv: PdfInvoice, t: Labels) {
  const lang = inv.buyer.language
  tableHeader(d, t)
  for (const l of inv.lines) {
    room(d, t, 0)
    d.page.put(margin, d.y, 9, l.description.slice(0, 48))
    d.page.right(col.qty, d.y, 8, `${String(l.quantity)} ${l.unit}`)
    d.page.right(col.price, d.y, 8, money(l.unit_price, lang))
    d.page.right(col.vat, d.y, 8, `${rateText(l.vat_code)}%`)
    d.page.right(col.amount, d.y, 8, money(l.net, lang))
    d.y -= 13
  }
}

// VAT per rate, the totals, and the payment details.
function totals(d: Doc, inv: PdfInvoice, t: Labels) {
  const lang = inv.buyer.language
  const s = inv.seller
  room(d, t, 60 + inv.rates.length * 13)
  d.y -= 10
  for (const r of inv.rates) {
    const base = `(${t.base} ${money(r.net, lang)})`
    d.page.put(margin, d.y, 9, `${t.vat} ${rateText(r.vat_code)} %  ${base}`)
    d.page.right(col.amount, d.y, 8, money(r.vat, lang))
    d.y -= 13
  }
  if (inv.rates.some((r) => r.vat_code === 'rc')) {
    d.page.put(margin, d.y, 9, t.reverse, 'bold')
    d.y -= 13
  }
  d.y -= 4
  for (const [label, n] of [
    [t.net, inv.totals.net],
    [t.vatTotal, inv.totals.vat],
  ] as const) {
    d.page.put(margin, d.y, 9, label)
    d.page.right(col.amount, d.y, 8, money(n, lang))
    d.y -= 13
  }
  d.y -= 3
  const credit = inv.kind === 'credit_note'
  d.page.put(margin, d.y, 11, credit ? t.totalCredit : t.total, 'bold')
  d.page.put(
    col.vat - 70,
    d.y,
    11,
    `${money(inv.totals.total, lang)} SEK`,
    'bold',
  )
  d.y -= 24
  if (credit) return
  const pay = `${t.pay[s.payment_kind]}: ${s.payment_number}    ${t.ocr}: ${inv.ocr}`
  d.page.put(margin, d.y, 9, pay)
  if (s.swish) d.page.put(margin, d.y - 12, 9, `${t.swish}: ${s.swish}`)
}

export function invoicePdf(inv: PdfInvoice) {
  const t = labels[inv.buyer.language]
  const first = new Page()
  const d: Doc = { pages: [first], page: first, y: 0 }
  d.y = parties(d, inv, t, head(d, inv, t))
  table(d, inv, t)
  totals(d, inv, t)
  const contact = [inv.seller.contact_email, inv.seller.contact_phone]
    .filter(Boolean)
    .join('  ')
  if (contact) d.pages.at(-1)?.put(margin, 40, 8, contact)
  return build(d.pages)
}

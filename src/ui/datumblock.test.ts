import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { DatumRow } from './DatumRow'
import { daysUntil, untilText } from './datumblock'

describe('daysUntil', () => {
  it('counts calendar days in Europe/Stockholm, not UTC', () => {
    // 23:30 UTC on 14 Mar is already 15 Mar in Stockholm.
    const now = new Date('2026-03-14T23:30:00Z')
    expect(daysUntil('2026-03-15', now)).toBe(0)
    expect(daysUntil('2026-03-26', now)).toBe(11)
    expect(daysUntil('2026-03-14', now)).toBe(-1)
  })
})

describe('untilText', () => {
  it('says idag, singular and plural', () => {
    expect([0, 1, 5, -3].map(untilText)).toEqual([
      'idag',
      'om 1 dag',
      'om 5 dagar',
      'för 3 dagar sedan',
    ])
  })
})

describe('DatumRow', () => {
  it('shows day, month, what is due, the amount in kronor and the days left', () => {
    const html = renderToStaticMarkup(
      createElement(DatumRow, {
        due: '2026-05-12',
        what: 'Moms',
        amount: 12500,
        now: new Date('2026-05-01T10:00:00Z'),
      }),
    )
    const text = html.replaceAll(/<[^>]+>/g, '|').replaceAll(/\|+/g, '|')
    expect(text).toContain('|12|maj|Moms|')
    expect(text).toMatch(/12\s500\skr/)
    expect(text).toContain('om 11 dagar')
  })
})

import { expect, test } from 'vitest'
import { kr, oreOf } from './money'

test('typed amounts become öre, anything else is refused', () => {
  expect(oreOf('125,50')).toBe(12550)
  expect(oreOf('1 250.5')).toBe(125050)
  expect(oreOf('99')).toBe(9900)
  expect(['', '0', '-5', '1,234', 'abc'].map(oreOf)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ])
})

test('öre are shown as kronor with a decimal comma', () => {
  expect(kr(12550).replace(/\s/g, ' ')).toBe('125,50 kr')
})

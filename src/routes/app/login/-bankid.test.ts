import { expect, test } from 'vitest'
import { countdownAnnouncement, countdownText } from './-bankid'

test('the countdown is read aloud only at BankID key points', () => {
  expect(countdownAnnouncement(300)).toBe('5 minuter kvar')
  expect(countdownAnnouncement(299)).toBe('5 minuter kvar')
  expect(countdownAnnouncement(240)).toBe('4 minuter kvar')
  expect(countdownAnnouncement(61)).toBe('2 minuter kvar')
  expect(countdownAnnouncement(60)).toBe('1 minut kvar')
  expect(countdownAnnouncement(50)).toBe('50 sekunder kvar')
  expect(countdownAnnouncement(11)).toBe('20 sekunder kvar')
  expect(countdownAnnouncement(1)).toBe('10 sekunder kvar')
})

test('the visible countdown is minutes and seconds', () => {
  expect(countdownText(300)).toBe('5:00')
  expect(countdownText(65)).toBe('1:05')
  expect(countdownText(9)).toBe('0:09')
})

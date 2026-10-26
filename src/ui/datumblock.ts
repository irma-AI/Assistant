const stockholm = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
})
const kronor = new Intl.NumberFormat('sv-SE', {
  style: 'currency',
  currency: 'SEK',
  maximumFractionDigits: 0,
})

export const formatKronor = (amount: number) => kronor.format(amount)

// Whole calendar days from `now` to the date `due` (YYYY-MM-DD), counted in Europe/Stockholm.
export function daysUntil(due: string, now: Date) {
  const today = stockholm.format(now)
  return Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000)
}

export function untilText(days: number) {
  if (days === 0) return 'idag'
  if (days === 1) return 'om 1 dag'
  if (days > 1) return `om ${String(days)} dagar`
  return days === -1 ? 'för 1 dag sedan' : `för ${String(-days)} dagar sedan`
}

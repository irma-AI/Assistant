// Whole öre to "125,50 kr" and back. Typed amounts take a comma or a point, and spaces for thousands.
export const kr = (ore: number) =>
  `${(ore / 100).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`

export function oreOf(text: string) {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.replace(/\s/g, ''))
  if (!m) return undefined
  const ore = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return ore > 0 && Number.isSafeInteger(ore) ? ore : undefined
}

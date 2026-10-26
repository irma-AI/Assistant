import { daysUntil, formatKronor, untilText } from './datumblock'

// Datumblock row: a date tile, what is due, the amount and the days left.
export function DatumRow({
  due,
  what,
  amount,
  now = new Date(),
}: {
  due: string
  what: string
  amount: number
  now?: Date
}) {
  const date = new Date(`${due}T00:00:00Z`)
  const month = date.toLocaleDateString('sv-SE', {
    month: 'short',
    timeZone: 'UTC',
  })
  return (
    <li className="datum-row">
      <time className="datum-tile" dateTime={due}>
        <strong>{date.getUTCDate()}</strong>
        <span>{month.replace('.', '')}</span>
      </time>
      <span className="datum-what">{what}</span>
      <span className="datum-amount">
        {formatKronor(amount)}
        <span className="muted"> {untilText(daysUntil(due, now))}</span>
      </span>
    </li>
  )
}

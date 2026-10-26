import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { sessions } from '#/api/schemas'
import { call, useList } from './org/$orgId/-call'

export const Route = createFileRoute('/app/konto')({ component: Account })

const kinds: Record<string, string> = {
  web: 'Webben',
  app: 'Appen',
  demo: 'Demokonto',
}
const when = (iso: string) =>
  new Date(iso).toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

function Devices() {
  const [rows, load] = useList('/api/v1/me/sessions', sessions)
  const [error, setError] = useState<string | null>(null)
  if (rows === undefined) return <p>Laddar…</p>
  async function end(url: string) {
    setError(await call(url, 'DELETE'))
    await load()
  }
  return (
    <section className="panel" aria-labelledby="devices">
      <h2 id="devices">Inloggade enheter</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            {kinds[row.kind] ?? row.kind}
            {row.current && ' · Den här enheten'}
            <br />
            Inloggad {when(row.startedAt)} · Senast använd{' '}
            {when(row.lastUsedAt)}
            {!row.current && (
              <>
                {' '}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void end(`/api/v1/me/sessions/${row.id}`)}
                >
                  Avsluta
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {rows.length > 1 && (
        <button
          type="button"
          className="secondary"
          onClick={() => void end('/api/v1/me/sessions')}
        >
          Avsluta alla andra
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

function Account() {
  const [failed, setFailed] = useState(false)
  return (
    <main>
      <h1>Konto</h1>
      <section className="panel">
        <p>
          <Link to="/app/installningar">Inställningar</Link>
        </p>
        <p>
          <a href="/api/v1/me/export" download>
            Ladda ner mina uppgifter
          </a>
        </p>
        <p>
          <Link to="/app/radera-konto" search={{ raderat: undefined }}>
            Radera mitt konto
          </Link>
        </p>
      </section>
      <Devices />
      <button
        type="button"
        className="secondary"
        onClick={() => {
          fetch('/api/v1/logout', { method: 'POST' }).then(
            (response) => {
              setFailed(!response.ok)
              // A full reload on purpose: it clears everything held in memory.
              if (response.ok) location.assign('/app/login')
            },
            () => {
              setFailed(true)
            },
          )
        }}
      >
        Logga ut
      </button>
      {failed && (
        <p role="alert" className="error">
          Utloggningen misslyckades. Försök igen.
        </p>
      )}
      <p>
        <a href="/villkor">Villkor</a>
        {' · '}
        <a href="/integritetspolicy">Integritetspolicy</a>
        {' · '}
        <a href="/personuppgiftsbitradesavtal">Personuppgiftsbiträdesavtal</a>
      </p>
    </main>
  )
}

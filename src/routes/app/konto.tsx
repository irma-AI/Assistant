import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/app/konto')({ component: Account })

function Account() {
  const [failed, setFailed] = useState(false)
  return (
    <main>
      <h1>Konto</h1>
      <section className="panel">
        <p>
          <a href="/app/installningar">Inställningar</a>
        </p>
        <p>
          <a href="/api/v1/me/export" download>
            Ladda ner mina uppgifter
          </a>
        </p>
        <p>
          <a href="/app/radera-konto">Radera mitt konto</a>
        </p>
      </section>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          fetch('/api/v1/logout', { method: 'POST' }).then(
            (response) => {
              setFailed(!response.ok)
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

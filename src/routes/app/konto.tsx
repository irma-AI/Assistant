import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/konto')({ component: Account })

function Account() {
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
          void fetch('/api/v1/logout', { method: 'POST' }).then(() => {
            location.assign('/app/login')
          })
        }}
      >
        Logga ut
      </button>
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

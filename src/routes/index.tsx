import { createFileRoute } from '@tanstack/react-router'
import { controller } from './-legal'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>Redo</h1>
      <p>
        Håll företagets bokföring rätt och uppdaterad utan att bli bokförare
        eller anlita en.
      </p>
      <p>
        <a className="btn" href="/app/login">
          Logga in
        </a>
      </p>
      <footer className="muted legal-links">
        <p>{controller}</p>
        <a href="/integritetspolicy">Integritetspolicy</a>{' '}
        <a href="/villkor">Villkor</a>{' '}
        <a href="/personuppgiftsbitradesavtal">Personuppgiftsbiträdesavtal</a>
      </footer>
    </main>
  )
}

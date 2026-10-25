import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>Assistant</h1>
      <footer>
        <a href="/integritetspolicy">Integritetspolicy</a>{' '}
        <a href="/villkor">Villkor</a>{' '}
        <a href="/personuppgiftsbitradesavtal">Personuppgiftsbiträdesavtal</a>
      </footer>
    </main>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({ component: App })

function App() {
  return (
    <main>
      <h1>App</h1>
      <p>
        <a href="/api/v1/me/export" download>
          Ladda ner mina uppgifter
        </a>
      </p>
      <p>
        <a href="/app/radera-konto">Radera mitt konto</a>
      </p>
    </main>
  )
}

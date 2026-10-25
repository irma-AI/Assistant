import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({ component: App })

function App() {
  return (
    <main>
      <h1>App</h1>
      <p>
        <a href="/app/radera-konto">Radera mitt konto</a>
      </p>
    </main>
  )
}

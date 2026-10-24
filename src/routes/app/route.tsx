import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  ssr: false,
  pendingComponent: () => <p>Loading…</p>,
  component: App,
})

function App() {
  return (
    <main>
      <h1>App</h1>
    </main>
  )
}

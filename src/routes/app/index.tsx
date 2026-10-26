import { Link, createFileRoute } from '@tanstack/react-router'
import { useShell } from '#/ui/shellContext'

export const Route = createFileRoute('/app/')({ component: Home })

const today = () =>
  new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

function Home() {
  const { active } = useShell()
  return (
    <main>
      <p className="muted">{today()}</p>
      {active ? (
        <h1 className="company">{active.name}</h1>
      ) : (
        <>
          <h1>Välkommen</h1>
          <p>
            Du har ingen organisation än.{' '}
            <Link to="/app/organisation">Skapa en organisation</Link>
          </p>
        </>
      )}
    </main>
  )
}

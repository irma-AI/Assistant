import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useShell } from '#/ui/shellContext'

export const Route = createFileRoute('/app/')({ component: Home })

const today = () =>
  new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

const Panel = ({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children?: ReactNode
}) => (
  <section className="panel">
    <h2>{title}</h2>
    {children ?? <p className="muted">{empty}</p>}
  </section>
)

function Home() {
  const { orgs, active } = useShell()
  if (!active)
    return (
      <main>
        <p className="muted">{today()}</p>
        <h1>Välkommen</h1>
        <p>
          Du har ingen organisation än. Skapa en för att samla bank, bokföring
          och skatt på ett ställe.
        </p>
        <Link to="/app/organisation" className="btn">
          Skapa organisation
        </Link>
      </main>
    )
  return (
    <main>
      <p className="muted">{today()}</p>
      <h1 className="company">
        {orgs.length > 1 ? (
          <Link to="/app/organisation">{active.name}</Link>
        ) : (
          active.name
        )}
      </h1>
      <Panel
        title="Snart dags"
        empty="Här visas skatter och fakturor som ska betalas, med datum och belopp. Inget är kopplat än."
      />
      <div className="money">
        <Panel
          title="På banken"
          empty="Här visas saldot och när banken senast synkades. Ingen bank är kopplad."
        />
        <Panel
          title="Resultat i år"
          empty="Här visas intäkter minus kostnader hittills i år. Inget är bokfört än."
        />
      </div>
      <Panel
        title="Att godkänna"
        empty="Här visas förslag som väntar på ditt godkännande. Inget väntar."
      />
    </main>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { Field } from '#/ui/Field'
import { useShell } from '#/ui/shellContext'
import { Invites } from './-Invites'

export const Route = createFileRoute('/app/organisation')({
  component: Organisations,
})

const OrgLinks = ({ id }: { id: string }) => (
  <p>
    <Link to="/app/org/$orgId/medlemmar" params={{ orgId: id }}>
      Medlemmar
    </Link>{' '}
    <Link to="/app/org/$orgId/roller" params={{ orgId: id }}>
      Roller
    </Link>{' '}
    <Link to="/app/org/$orgId/kunder" params={{ orgId: id }}>
      Kunder
    </Link>{' '}
    <Link to="/app/org/$orgId/fakturor" params={{ orgId: id }}>
      Fakturor
    </Link>{' '}
    <Link to="/app/org/$orgId/kvitton" params={{ orgId: id }}>
      Kvitton
    </Link>{' '}
    <Link to="/app/org/$orgId/notiser" params={{ orgId: id }}>
      Aviseringar
    </Link>{' '}
    <Link to="/app/org/$orgId/uppgifter" params={{ orgId: id }}>
      Företagsuppgifter
    </Link>
  </p>
)

function Organisations() {
  const { orgs, active, choose, reload } = useShell()
  const [name, setName] = useState('')
  const [failed, setFailed] = useState(false)

  async function create(event: SyntheticEvent) {
    event.preventDefault()
    const response = await fetch('/api/v1/orgs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setFailed(!response.ok)
    if (response.ok) {
      setName('')
      await reload()
    }
  }

  return (
    <main>
      <h1>Organisation</h1>
      <ul>
        {orgs.map((o) => (
          <li key={o.id} className="panel">
            <button
              type="button"
              className="org-choice"
              aria-pressed={active?.id === o.id}
              onClick={() => {
                choose(o.id)
              }}
            >
              <strong>{o.name}</strong>
              <br />
              <span className="muted">
                {o.role}
                {active?.id === o.id && ' · Vald'}
              </span>
            </button>
            {o.role === 'Ägare' && o.owners === 1 && (
              <p role="note">
                Organisationen har bara en Ägare. Vi rekommenderar två.
              </p>
            )}
            <OrgLinks id={o.id} />
            <Invites orgId={o.id} />
          </li>
        ))}
      </ul>
      <form className="panel" onSubmit={(e) => void create(e)}>
        <h2>Skapa organisation</h2>
        <Field
          label="Namn"
          value={name}
          required
          maxLength={100}
          error={failed ? 'Något gick fel. Försök igen.' : undefined}
          onChange={(e) => {
            setName(e.target.value)
          }}
        />
        <button type="submit">Skapa organisation</button>
      </form>
    </main>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { organisations } from '#/api/schemas'
import type { z } from 'zod'
import { Invites } from './-Invites'

export const Route = createFileRoute('/app/')({ component: App })

type Orgs = z.infer<typeof organisations>

const OrgLinks = ({ id }: { id: string }) => (
  <p>
    <a href={`/app/org/${id}/medlemmar`}>Medlemmar</a>{' '}
    <a href={`/app/org/${id}/roller`}>Roller</a>{' '}
    <a href={`/app/org/${id}/kunder`}>Kunder</a>{' '}
    <a href={`/app/org/${id}/notiser`}>Aviseringar</a>
  </p>
)

const AccountLinks = () => (
  <>
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
  </>
)

function App() {
  // undefined while loading, null when not logged in
  const [orgs, setOrgs] = useState<Orgs | null>()
  const [name, setName] = useState('')
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch('/api/v1/orgs')
    setOrgs(response.ok ? organisations.parse(await response.json()) : null)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

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
      await load()
    }
  }

  if (orgs === undefined) return <p>Laddar…</p>
  if (orgs === null)
    return (
      <main>
        <h1>App</h1>
        <p>
          <a href="/app/login">Logga in</a>
        </p>
      </main>
    )

  return (
    <main>
      <h1>{orgs.length ? 'Organisationer' : 'Skapa organisation'}</h1>
      {orgs.length > 0 && (
        <ul>
          {orgs.map((o) => (
            <li key={o.id}>
              {o.name} ({o.role})
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
      )}
      <form onSubmit={(e) => void create(e)}>
        {failed && <p role="alert">Något gick fel. Försök igen.</p>}
        <label>
          Namn
          <input
            value={name}
            required
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value)
            }}
          />
        </label>
        <button type="submit">Skapa organisation</button>
      </form>
      <AccountLinks />
    </main>
  )
}

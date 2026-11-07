import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { z } from 'zod'
import { emailAddress, noticePreferences } from '#/api/schemas'
import { call, fetchJson, fetchList } from './org/$orgId/-call'
import { isOld } from '#/ui/loaded'

export const Route = createFileRoute('/app/installningar')({
  shouldReload: ({ location }) => isOld(location.pathname),
  loader: async () => {
    const [address, prefs] = await Promise.all([
      fetchJson('/api/v1/me/email', emailAddress),
      fetchList('/api/v1/me/notifications', noticePreferences),
    ])
    return { address, prefs }
  },
  component: Settings,
})

function Settings() {
  const { address, prefs } = Route.useLoaderData()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save(event: SyntheticEvent) {
    event.preventDefault()
    const failed = await call('/api/v1/me/email', 'PUT', { email })
    setError(failed)
    setMessage(
      failed
        ? null
        : `Vi har skickat en länk till ${email}. Öppna den för att bekräfta adressen.`,
    )
    await router.invalidate()
  }

  async function toggle(type: string, on: boolean) {
    setError(
      await call(`/api/v1/me/notifications/${type}`, 'PUT', { email: on }),
    )
    await router.invalidate()
  }

  return (
    <main>
      <h1>Inställningar</h1>
      <h2>E-post för aviseringar</h2>
      <p>
        Vi använder adressen bara för aviseringar du har rätt att se som medlem.
        Vi skickar inget dit förrän du har bekräftat den, och du kan byta den
        när du vill. Aviseringar visas alltid i appen.
      </p>
      {address.email && (
        <p>
          Din adress: <strong>{address.email}</strong>{' '}
          {address.verified ? '(bekräftad)' : '(inte bekräftad ännu)'}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <form onSubmit={(e) => void save(e)}>
        <label>
          E-postadress
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
            }}
          />
        </label>
        <button type="submit">Skicka bekräftelselänk</button>
      </form>
      <Preferences prefs={prefs} onChange={toggle} />
    </main>
  )
}

type Prefs = z.output<typeof noticePreferences>

function Preferences(p: {
  prefs: Prefs
  onChange: (type: string, on: boolean) => Promise<void>
}) {
  return (
    <>
      <h2>Aviseringar</h2>
      <ul>
        {p.prefs.map((x) => (
          <li key={x.type}>
            <label>
              <input
                type="checkbox"
                checked={x.email}
                disabled={x.mandatory}
                onChange={(e) => void p.onChange(x.type, e.target.checked)}
              />
              {x.label}: skicka e-post
            </label>
            {x.mandatory && (
              <>
                <br />
                Går inte att stänga av, eftersom du måste agera för att tjänsten
                ska fortsätta fungera.
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

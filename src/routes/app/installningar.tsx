import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import type { z } from 'zod'
import { emailAddress, noticePreferences } from '#/api/schemas'
import { call, useList } from './org/$orgId/-call'

export const Route = createFileRoute('/app/installningar')({
  component: Settings,
})

function Settings() {
  const [address, setAddress] = useState<z.output<typeof emailAddress>>()
  const [prefs, loadPrefs] = useList(
    '/api/v1/me/notifications',
    noticePreferences,
  )
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadAddress = useCallback(async () => {
    const response = await fetch('/api/v1/me/email')
    if (response.ok) setAddress(emailAddress.parse(await response.json()))
  }, [])
  useEffect(() => {
    void loadAddress()
  }, [loadAddress])

  if (address === undefined || prefs === undefined) return <p>Laddar…</p>

  async function save(event: SyntheticEvent) {
    event.preventDefault()
    const failed = await call('/api/v1/me/email', 'PUT', { email })
    setError(failed)
    setMessage(
      failed
        ? null
        : `Vi har skickat en länk till ${email}. Öppna den för att bekräfta adressen.`,
    )
    await loadAddress()
  }

  async function toggle(type: string, on: boolean) {
    setError(
      await call(`/api/v1/me/notifications/${type}`, 'PUT', { email: on }),
    )
    await loadPrefs()
  }

  return (
    <main>
      <p>
        <a href="/app">Tillbaka</a>
      </p>
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

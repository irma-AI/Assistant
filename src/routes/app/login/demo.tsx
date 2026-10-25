import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/app/login/demo')({ component: Demo })

// For store reviewers, who have no BankID (IRM-91).
function Demo() {
  const [failed, setFailed] = useState('')

  async function submit(form: FormData) {
    const response = await fetch('/api/v1/auth/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    })
    if (response.ok) location.assign('/app')
    else
      setFailed(
        response.status === 429
          ? 'För många försök. Vänta en stund.'
          : 'Fel användarnamn eller lösenord.',
      )
  }

  return (
    <main>
      <h1>Demokonto</h1>
      <p>
        För granskare i App Store och Google Play. Kontot innehåller bara
        påhittad data.
      </p>
      {failed && <p role="alert">{failed}</p>}
      <form action={submit}>
        <p>
          <label>
            Användarnamn{' '}
            <input name="username" autoComplete="username" required />
          </label>
        </p>
        <p>
          <label>
            Lösenord{' '}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
        </p>
        <button type="submit">Logga in</button>
      </form>
    </main>
  )
}

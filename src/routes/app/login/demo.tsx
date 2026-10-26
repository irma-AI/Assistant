import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Field } from '#/ui/Field'

export const Route = createFileRoute('/app/login/demo')({ component: Demo })

const messageFor = (status: number) =>
  status === 401
    ? 'Fel användarnamn eller lösenord.'
    : status === 429
      ? 'För många försök. Vänta en stund och försök igen.'
      : status === 404
        ? 'Demokontot är avstängt just nu.'
        : 'Något gick fel. Försök igen.'

// For store reviewers, who have no BankID. The server answers 404 when the demo login is off.
function Demo() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const submit = async () => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/v1/auth/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (response.ok) void navigate({ to: '/app' })
      else setMessage(messageFor(response.status))
    } catch {
      setMessage('Något gick fel. Försök igen.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main>
      <h1>Demokonto</h1>
      <form action={submit} className="panel">
        <Field
          label="Användarnamn"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
          }}
          required
        />
        <Field
          label="Lösenord"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
          }}
          required
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Loggar in…' : 'Logga in'}
        </button>
      </form>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </main>
  )
}

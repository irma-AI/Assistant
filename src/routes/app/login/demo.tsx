import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/app/login/demo')({ component: Demo })

// For store reviewers, who have no BankID. The server answers 404 when the demo login is off.
function Demo() {
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const submit = async () => {
    const response = await fetch('/api/v1/auth/demo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (response.ok) void navigate({ to: '/app' })
    else setFailed(true)
  }
  return (
    <main>
      <h1>Demokonto</h1>
      <form action={submit}>
        <label>
          Användarnamn
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
            }}
            required
          />
        </label>
        <label>
          Lösenord
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
            required
          />
        </label>
        <button type="submit">Logga in</button>
      </form>
      {failed && <p role="alert">Fel användarnamn eller lösenord.</p>}
    </main>
  )
}

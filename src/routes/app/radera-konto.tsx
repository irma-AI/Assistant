import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BankIdPanel } from './login/-BankIdPanel'

// Also the public web address for deleting an account, which Google Play's Data safety form asks for.
export const Route = createFileRoute('/app/radera-konto')({
  validateSearch: (search) => ({ raderat: search.raderat === true }),
  component: DeleteAccount,
})

// The demo account has no BankID, so it confirms with its password.
function DemoDelete() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/v1/auth/demo/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) location.assign('/app/radera-konto?raderat=true')
      else
        setMessage(
          response.status === 401
            ? 'Fel lösenord, eller så är du inte inloggad på demokontot.'
            : 'Något gick fel. Försök igen.',
        )
    } catch {
      setMessage('Något gick fel. Försök igen.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <details>
      <summary>Demokonto</summary>
      <form action={submit}>
        <label>
          Lösenord
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
            required
          />
        </label>
        <button type="submit" className="secondary" disabled={busy}>
          {busy ? 'Raderar…' : 'Radera demokontot'}
        </button>
      </form>
      {message && <p role="alert">{message}</p>}
    </details>
  )
}

function DeleteAccount() {
  const { raderat } = Route.useSearch()
  return (
    <main>
      <h1>Radera mitt konto</h1>
      {raderat ? (
        <p role="status">
          Ditt konto är raderat. Personnummer, sessioner och inloggningar är
          borttagna och du är utloggad överallt.
        </p>
      ) : (
        <>
          <p>
            Vi raderar ditt konto direkt: personnummer, sessioner och
            inloggningar. Du loggas ut överallt.
          </p>
          <p>
            Ditt namn finns kvar på bokföringsposter du har gjort, så länge
            bokföringslagen kräver det. Säkerhetskopior förfaller enligt{' '}
            <a href="/integritetspolicy">integritetspolicyn</a>.
          </p>
          <p>Bekräfta med BankID att du vill radera kontot.</p>
          <div className="panel">
            <BankIdPanel purpose="delete" verb="Radera mitt konto" quiet />
          </div>
          <DemoDelete />
        </>
      )}
    </main>
  )
}

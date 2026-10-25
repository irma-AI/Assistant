import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { BankIdPanel } from './login/-BankIdPanel'

// Also the public web address for deleting an account, which Google Play's Data safety form asks for.
export const Route = createFileRoute('/app/radera-konto')({
  validateSearch: (search) => ({ raderat: search.raderat === true }),
  component: DeleteAccount,
})

// The demo account has no BankID, so it confirms with its password (IRM-91).
function DemoDelete() {
  const [failed, setFailed] = useState(false)
  async function submit(form: FormData) {
    const response = await fetch('/api/v1/auth/demo/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    })
    if (response.ok) location.assign('/app/radera-konto?raderat=true')
    else setFailed(true)
  }
  return (
    <details>
      <summary>Demokonto: radera med lösenord</summary>
      {failed && <p role="alert">Fel lösenord.</p>}
      <form action={submit}>
        <label>
          Lösenord{' '}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>{' '}
        <button type="submit">Radera demokontot</button>
      </form>
    </details>
  )
}

function DeleteAccount() {
  const { raderat } = Route.useSearch()
  return (
    <main>
      <h1>Radera mitt konto</h1>
      {raderat ? (
        <p role="status">Ditt konto är raderat.</p>
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
          <BankIdPanel purpose="delete" verb="Radera mitt konto" />
          <DemoDelete />
        </>
      )}
    </main>
  )
}

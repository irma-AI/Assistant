import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { expiredMessage, failedMessage, poll } from './-bankid'

export const Route = createFileRoute('/app/login/return')({
  component: Return,
})

// The BankID app sends the browser back here with the nonce from the returnUrl in the fragment.
function Return() {
  const navigate = useNavigate()
  const [message, setMessage] = useState<string>()
  const [hint, setHint] = useState('')

  useEffect(() => {
    const nonce = new URLSearchParams(location.hash.slice(1)).get('nonce')
    if (!nonce) {
      setMessage(failedMessage)
      return
    }
    const timer = setInterval(() => {
      poll(nonce).then(
        (next) => {
          if (next.status === 'pending') {
            setHint(next.message)
            return
          }
          clearInterval(timer)
          if (next.status === 'complete') void navigate({ to: '/app' })
          else
            setMessage(next.status === 'failed' ? next.message : expiredMessage)
        },
        () => undefined,
      )
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [navigate])

  return (
    <main>
      <h1>Logga in</h1>
      {message ? (
        <>
          <p role="alert">{message}</p>
          <p>
            <a href="/app/login">Försök igen</a>
          </p>
        </>
      ) : (
        <p role="status">{hint || 'Slutför inloggningen…'}</p>
      )}
    </main>
  )
}

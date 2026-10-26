import {
  Link,
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { takeNext } from '#/ui/storage'
import { expiredMessage, failedMessage, poll } from './-bankid'

export const Route = createFileRoute('/app/login/return')({
  validateSearch: (search) => ({
    purpose: search.purpose === 'delete' ? ('delete' as const) : undefined,
  }),
  component: Return,
})

// The BankID app sends the browser back here with the nonce from the returnUrl in the fragment.
function Return() {
  const navigate = useNavigate()
  const { history } = useRouter()
  const { purpose } = Route.useSearch()
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
            if (next.message) setHint(next.message)
            return
          }
          clearInterval(timer)
          if (next.status === 'complete') {
            if (purpose === 'delete')
              void navigate({
                to: '/app/radera-konto',
                search: { raderat: true },
              })
            else history.push(takeNext())
          } else
            setMessage(next.status === 'failed' ? next.message : expiredMessage)
        },
        () => undefined,
      )
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [navigate, history, purpose])

  return (
    <main>
      <h1>Logga in</h1>
      {message ? (
        <>
          <p role="alert">{message}</p>
          <Link className="btn" to="/app/login">
            Försök igen
          </Link>
        </>
      ) : (
        <p role="status">
          <progress aria-hidden="true" />{' '}
          {hint || 'Slutför inloggningen med BankID…'}
        </p>
      )}
    </main>
  )
}

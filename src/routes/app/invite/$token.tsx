import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import { invitePreview } from '#/api/schemas'
import { BankIdPanel } from '../login/-BankIdPanel'

export const Route = createFileRoute('/app/invite/$token')({
  loader: async ({ params }) => {
    const response = await fetch(`/api/v1/invites/${params.token}`)
    return {
      // null for a link that does not work
      organisation: response.ok
        ? invitePreview.parse(await response.json()).organisation
        : null,
      loggedIn: (await fetch('/api/v1/me')).ok,
    }
  },
  // The token is in the address, so the page must not leak it through the Referer header.
  head: () => ({ meta: [{ name: 'referrer', content: 'no-referrer' }] }),
  // One-time link: never shown from the cache.
  gcTime: 0,
  component: Invite,
})

const neutral = 'Länken fungerar inte. Be om en ny inbjudan.'

function Invite() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const { organisation, loggedIn: wasLoggedIn } = Route.useLoaderData()
  const [loggedIn, setLoggedIn] = useState(wasLoggedIn)
  const [failed, setFailed] = useState(false)

  const accept = useCallback(async () => {
    const response = await fetch(`/api/v1/invites/${token}/accept`, {
      method: 'POST',
    })
    if (response.ok) void navigate({ to: '/app' })
    else {
      setFailed(true)
      setLoggedIn(true)
    }
  }, [token, navigate])

  const afterLogin = useCallback(() => void accept(), [accept])

  if (organisation === null || failed)
    return (
      <main>
        <h1>Inbjudan</h1>
        <p role="alert">{neutral}</p>
      </main>
    )
  return (
    <main>
      <h1>Inbjudan till {organisation}</h1>
      {loggedIn ? (
        <p>
          <button type="button" onClick={() => void accept()}>
            Gå med i {organisation}
          </button>
        </p>
      ) : (
        <BankIdPanel
          purpose="login"
          verb="Logga in och gå med"
          loggedIn={afterLogin}
        />
      )}
    </main>
  )
}

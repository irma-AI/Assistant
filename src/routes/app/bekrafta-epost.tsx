import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { call } from './org/$orgId/-call'

export const Route = createFileRoute('/app/bekrafta-epost')({
  component: ConfirmEmail,
})

// The link's token sits after the #, so it never reaches a server log or a Referer header.
function ConfirmEmail() {
  const [state, setState] = useState<string | null>()
  useEffect(() => {
    const token = location.hash.slice(1)
    void call('/api/v1/me/email/confirm', 'POST', { token }).then(setState)
  }, [])
  return (
    <main>
      <h1>Bekräfta e-postadress</h1>
      {state === undefined && <p>Bekräftar…</p>}
      {state === null && (
        <p role="status">
          Klart. Adressen är bekräftad och aviseringar kan skickas dit.
        </p>
      )}
      {state && <p role="alert">{state}</p>}
      <p>
        <a href="/app/installningar">Till inställningar</a>
      </p>
    </main>
  )
}

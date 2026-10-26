import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { notices } from '#/api/schemas'
import { call, useList } from './-call'

export const Route = createFileRoute('/app/org/$orgId/notiser')({
  component: Notices,
})

function Notices() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}/notifications`
  const [list, load] = useList(base, notices)
  const [error, setError] = useState<string | null>(null)

  if (list === undefined) return <p>Laddar…</p>

  async function markRead(id: string) {
    const failed = await call(`${base}/${id}/read`, 'POST')
    setError(failed)
    if (!failed) await load()
  }

  return (
    <main>
      <h1>Aviseringar</h1>
      {error && <p role="alert">{error}</p>}
      {list.length === 0 && <p>Inga aviseringar.</p>}
      <ul>
        {list.map((n) => (
          <li key={n.id}>
            <strong>{n.title}</strong> {n.read ? '(läst)' : '(oläst)'}
            <br />
            {n.body}
            <br />
            <time dateTime={n.created_at}>
              {new Date(n.created_at).toLocaleString('sv-SE')}
            </time>
            {!n.read && (
              <>
                <br />
                <button type="button" onClick={() => void markRead(n.id)}>
                  Markera som läst
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

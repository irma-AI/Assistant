import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { notices } from '#/api/schemas'
import { call, fetchList } from './-call'
import { isOld } from '#/ui/loaded'

export const Route = createFileRoute('/app/org/$orgId/notiser')({
  shouldReload: ({ location }) => isOld(location.pathname),
  loader: ({ params }) =>
    fetchList(`/api/v1/orgs/${params.orgId}/notifications`, notices),
  component: Notices,
})

function Notices() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}/notifications`
  const list = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function markRead(id: string) {
    const failed = await call(`${base}/${id}/read`, 'POST')
    setError(failed)
    if (!failed) await router.invalidate()
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

import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { memberList, roleList } from '#/api/schemas'
import { call, useList, usePermissions } from './-call'

export const Route = createFileRoute('/app/org/$orgId/medlemmar')({
  component: Members,
})

function Members() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}`
  const mine = usePermissions(orgId)
  const [members, loadMembers] = useList(`${base}/members`, memberList)
  const [roles, loadRoles] = useList(`${base}/roles`, roleList)
  const [error, setError] = useState<string | null>(null)

  const load = () => Promise.all([loadMembers(), loadRoles()])

  if (mine === null || members === undefined) return <p>Laddar…</p>
  const canManage = mine.includes('members.manage')

  async function act(run: Promise<string | null>) {
    const failed = await run
    setError(failed)
    await load()
  }

  return (
    <main>
      <p>
        <a href="/app">Tillbaka</a>
      </p>
      <h1>Medlemmar</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            <strong>{m.name}</strong>
            {canManage ? (
              <>
                {' '}
                <label>
                  Roll för {m.name}
                  <select
                    value={m.role_id}
                    onChange={(e) =>
                      void act(
                        call(`${base}/members/${m.id}`, 'PATCH', {
                          roleId: e.target.value,
                        }),
                      )
                    }
                  >
                    {(roles ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>{' '}
                <button
                  type="button"
                  onClick={() =>
                    void act(call(`${base}/members/${m.id}`, 'DELETE'))
                  }
                >
                  Ta bort {m.name}
                </button>
              </>
            ) : (
              <> – {m.role}</>
            )}
          </li>
        ))}
      </ul>
    </main>
  )
}

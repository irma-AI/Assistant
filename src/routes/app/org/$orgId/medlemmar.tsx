import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { memberList, roleList } from '#/api/schemas'
import { call, fetchList, fetchPermissions } from './-call'
import { isOld } from '#/ui/loaded'

export const Route = createFileRoute('/app/org/$orgId/medlemmar')({
  shouldReload: ({ location }) => isOld(location.pathname),
  loader: async ({ params }) => {
    const base = `/api/v1/orgs/${params.orgId}`
    const [mine, members, roles] = await Promise.all([
      fetchPermissions(params.orgId),
      fetchList(`${base}/members`, memberList),
      fetchList(`${base}/roles`, roleList),
    ])
    return { mine, members, roles }
  },
  component: Members,
})

function Members() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}`
  const { mine, members, roles } = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const canManage = mine.includes('members.manage')

  async function act(run: Promise<string | null>) {
    const failed = await run
    setError(failed)
    await router.invalidate()
  }

  return (
    <main>
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
                    {roles.map((r) => (
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

import { useCallback, useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { z } from 'zod'
import { createdInvite, invites } from '#/api/schemas'

const roleList = z.array(
  z.object({ id: z.string(), name: z.string(), kind: z.string() }),
)
const myAccess = z.object({ permissions: z.array(z.string()) })

function useInvites(orgId: string) {
  const base = `/api/v1/orgs/${orgId}`
  const [allowed, setAllowed] = useState(false)
  const [roles, setRoles] = useState<z.infer<typeof roleList>>([])
  const [pending, setPending] = useState<z.infer<typeof invites>>([])
  const [roleId, setRoleId] = useState('')
  const [link, setLink] = useState('')
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    const me = await fetch(`${base}/me`)
    if (
      !me.ok ||
      !myAccess.parse(await me.json()).permissions.includes('members.manage')
    )
      return
    const [r, i] = await Promise.all([
      fetch(`${base}/roles`),
      fetch(`${base}/invites`),
    ])
    const list = roleList
      .parse(await r.json())
      .filter((x) => x.kind !== 'owner')
    setRoles(list)
    setRoleId((prev) => prev || (list[0]?.id ?? ''))
    setPending(invites.parse(await i.json()))
    setAllowed(true)
  }, [base])
  useEffect(() => {
    void load()
  }, [load])

  async function create(event: SyntheticEvent) {
    event.preventDefault()
    const response = await fetch(`${base}/invites`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roleId }),
    })
    setFailed(!response.ok)
    if (!response.ok) return
    const { token } = createdInvite.parse(await response.json())
    setLink(`${location.origin}/app/invite/${token}`)
    await load()
  }

  async function revoke(id: string) {
    await fetch(`${base}/invites/${id}`, { method: 'DELETE' })
    setLink('')
    await load()
  }

  return {
    allowed,
    roles,
    pending,
    roleId,
    setRoleId,
    link,
    failed,
    create,
    revoke,
  }
}

// Invite links for one organisation; shown only to someone who can manage members.
export function Invites({ orgId }: { orgId: string }) {
  const {
    allowed,
    roles,
    pending,
    roleId,
    setRoleId,
    link,
    failed,
    create,
    revoke,
  } = useInvites(orgId)
  if (!allowed) return null
  return (
    <section>
      <h2>Bjud in</h2>
      <form onSubmit={(e) => void create(e)}>
        {failed && <p role="alert">Något gick fel. Försök igen.</p>}
        <label>
          Roll
          <select
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value)
            }}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Skapa inbjudningslänk</button>
      </form>
      {link && (
        <p>
          <label>
            Länk (gäller i 7 dagar, används en gång)
            <input
              readOnly
              value={link}
              onFocus={(e) => {
                e.target.select()
              }}
            />
          </label>
        </p>
      )}
      {pending.length > 0 && (
        <ul aria-label="Väntande inbjudningar">
          {pending.map((p) => (
            <li key={p.id}>
              {p.role}, gäller till{' '}
              {new Date(p.expires_at).toLocaleDateString('sv-SE')}{' '}
              <button type="button" onClick={() => void revoke(p.id)}>
                Återkalla
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { permission, roleList } from '#/api/schemas'
import { permissionText } from '#/api/permissions'
import { call, useList, usePermissions } from './-call'

export const Route = createFileRoute('/app/org/$orgId/roller')({
  component: Roles,
})

type Role = (typeof roleList)['_output'][number]

function Roles() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}/roles`
  const mine = usePermissions(orgId)
  const [roles, load] = useList(base, roleList)
  // Id of the role being edited, '' for a new one, null for none
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  if (mine === null || roles === undefined) return <p>Laddar…</p>
  const canManage = mine.includes('roles.manage')

  function open(role?: Role) {
    setEditing(role?.id ?? '')
    setName(role?.name ?? '')
    setChosen(role?.permissions ?? [])
    setError(null)
  }

  async function save(event: SyntheticEvent) {
    event.preventDefault()
    const body = { name, permissions: chosen }
    const failed = editing
      ? await call(`${base}/${editing}`, 'PATCH', body)
      : await call(base, 'POST', body)
    setError(failed)
    if (failed) return
    setEditing(null)
    await load()
  }

  async function remove(id: string) {
    const failed = await call(`${base}/${id}`, 'DELETE')
    setError(failed)
    if (!failed) await load()
  }

  return (
    <main>
      <h1>Roller</h1>
      {error && editing === null && <p role="alert">{error}</p>}
      <ul>
        {roles.map((r) => (
          <RoleItem
            key={r.id}
            role={r}
            canManage={canManage}
            onEdit={() => {
              open(r)
            }}
            onDelete={() => void remove(r.id)}
          />
        ))}
      </ul>
      {canManage && editing === null && (
        <button
          type="button"
          onClick={() => {
            open()
          }}
        >
          Skapa roll
        </button>
      )}
      {canManage && editing !== null && (
        <RoleForm
          title={editing ? 'Ändra roll' : 'Ny roll'}
          error={error}
          name={name}
          chosen={chosen}
          onName={setName}
          onChosen={setChosen}
          onSubmit={(e) => void save(e)}
          onCancel={() => {
            setEditing(null)
          }}
        />
      )}
    </main>
  )
}

type FormProps = {
  title: string
  error: string | null
  name: string
  chosen: string[]
  onName: (name: string) => void
  onChosen: (chosen: string[]) => void
  onSubmit: (event: SyntheticEvent) => void
  onCancel: () => void
}

function RoleForm(p: FormProps) {
  return (
    <form onSubmit={p.onSubmit}>
      <h2>{p.title}</h2>
      {p.error && <p role="alert">{p.error}</p>}
      <label>
        Namn
        <input
          value={p.name}
          required
          maxLength={50}
          onChange={(e) => {
            p.onName(e.target.value)
          }}
        />
      </label>
      <fieldset>
        <legend>Behörigheter</legend>
        {permission.options.map((x) => (
          <p key={x}>
            <label>
              <input
                type="checkbox"
                checked={p.chosen.includes(x)}
                onChange={(e) => {
                  p.onChosen(
                    e.target.checked
                      ? [...p.chosen, x]
                      : p.chosen.filter((y) => y !== x),
                  )
                }}
              />{' '}
              {permissionText[x].label}
            </label>
            <br />
            <small>{permissionText[x].help}</small>
          </p>
        ))}
      </fieldset>
      <button type="submit">Spara roll</button>{' '}
      <button type="button" onClick={p.onCancel}>
        Avbryt
      </button>
    </form>
  )
}

function RoleItem(p: {
  role: Role
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const r = p.role
  return (
    <li>
      <strong>{r.name}</strong>
      {r.kind === 'owner' && ' (kan inte ändras)'}
      <ul aria-label={`Behörigheter för ${r.name}`}>
        {r.permissions.map((x) => (
          <li key={x}>
            {permission.safeParse(x).success
              ? permissionText[permission.parse(x)].label
              : x}
          </li>
        ))}
      </ul>
      {p.canManage && r.kind !== 'owner' && (
        <>
          <button type="button" onClick={p.onEdit}>
            Ändra {r.name}
          </button>{' '}
          <button type="button" onClick={p.onDelete}>
            Ta bort {r.name}
          </button>
        </>
      )}
    </li>
  )
}

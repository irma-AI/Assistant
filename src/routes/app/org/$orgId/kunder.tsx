import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { customerList } from '#/api/schemas'
import { CsvImport } from './-CsvImport'
import { call, useList, usePermissions } from './-call'

export const Route = createFileRoute('/app/org/$orgId/kunder')({
  component: Customers,
})

type Customer = (typeof customerList)['_output'][number]
type Form = Record<string, string>

const empty: Form = { kind: 'business', language: 'sv' }
const text = (c: Customer): Form =>
  Object.fromEntries(
    Object.entries(c).map(([k, v]) => [k, v === null ? '' : String(v)]),
  )
// The API wants numbers for payment terms and nothing for empty fields.
const body = (f: Form) => ({
  ...f,
  payment_terms_days: f.payment_terms_days
    ? Number(f.payment_terms_days)
    : undefined,
})

function Customers() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}/customers`
  const mine = usePermissions(orgId)
  const [customers, load] = useList(base, customerList)
  // Id of the customer being edited, '' for a new one, null for none
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(empty)
  const [error, setError] = useState<string | null>(null)

  if (mine === null || customers === undefined) return <p>Laddar…</p>
  const canManage = mine.includes('customers.manage')

  async function save(event: SyntheticEvent) {
    event.preventDefault()
    const failed = editing
      ? await call(`${base}/${editing}`, 'PUT', body(form))
      : await call(base, 'POST', body(form))
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
      <h1>Kunder</h1>
      {error && editing === null && <p role="alert">{error}</p>}
      <ul>
        {customers.map((c) => (
          <CustomerItem
            key={c.id}
            c={c}
            canManage={canManage}
            onEdit={() => {
              setForm(text(c))
              setEditing(c.id)
              setError(null)
            }}
            onDelete={() => void remove(c.id)}
          />
        ))}
      </ul>
      {canManage &&
        (editing === null ? (
          <button
            type="button"
            onClick={() => {
              setForm(empty)
              setEditing('')
              setError(null)
            }}
          >
            Lägg till kund
          </button>
        ) : (
          <CustomerForm
            form={form}
            error={error}
            title={editing ? 'Ändra kund' : 'Ny kund'}
            onChange={setForm}
            onSubmit={(e) => void save(e)}
            onCancel={() => {
              setEditing(null)
            }}
          />
        ))}
      {canManage && <CsvImport url={`${base}/import`} onSaved={load} />}
    </main>
  )
}

function CustomerItem(p: {
  c: Customer
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const c = p.c
  return (
    <li>
      <strong>{c.name}</strong>
      {c.kind === 'business' ? ' (företag)' : ' (privat)'}
      <br />
      {c.address}
      {c.org_number && <> · {c.org_number}</>}
      {p.canManage && (
        <>
          <br />
          <button type="button" onClick={p.onEdit}>
            Ändra {c.name}
          </button>{' '}
          <button type="button" onClick={p.onDelete}>
            Ta bort {c.name}
          </button>
        </>
      )}
    </li>
  )
}

function CustomerForm(p: {
  form: Form
  error: string | null
  title: string
  onChange: (f: Form) => void
  onSubmit: (e: SyntheticEvent) => void
  onCancel: () => void
}) {
  const business = p.form.kind === 'business'
  const input = (field: string, label: string, required = false) => (
    <p>
      <label>
        {label}
        <input
          value={p.form[field] ?? ''}
          required={required}
          onChange={(e) => {
            p.onChange({ ...p.form, [field]: e.target.value })
          }}
        />
      </label>
    </p>
  )
  return (
    <form onSubmit={p.onSubmit}>
      <h2>{p.title}</h2>
      {p.error && <p role="alert">{p.error}</p>}
      <p>
        <label>
          Typ
          <select
            value={p.form.kind}
            onChange={(e) => {
              p.onChange({ ...p.form, kind: e.target.value })
            }}
          >
            <option value="business">Företag</option>
            <option value="consumer">Privatperson</option>
          </select>
        </label>
      </p>
      {input('name', 'Namn', true)}
      {input('address', 'Adress', true)}
      {input('email', 'E-post för fakturor')}
      <p>
        <label>
          Språk
          <select
            value={p.form.language}
            onChange={(e) => {
              p.onChange({ ...p.form, language: e.target.value })
            }}
          >
            <option value="sv">Svenska</option>
            <option value="en">Engelska</option>
          </select>
        </label>
      </p>
      {business && (
        <>
          {input('org_number', 'Organisationsnummer')}
          {input('vat_number', 'Momsregistreringsnummer')}
          {input('contact', 'Kontaktperson')}
          {input(
            'payment_terms_days',
            'Betalningsvillkor (dagar, standard 30)',
          )}
        </>
      )}
      <button type="submit">Spara kund</button>{' '}
      <button type="button" onClick={p.onCancel}>
        Avbryt
      </button>
    </form>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import { company } from '#/api/company'
import { call, usePermissions } from './-call'

export const Route = createFileRoute('/app/org/$orgId/uppgifter')({
  component: Company,
})

const empty = {
  org_number: '',
  legal_name: '',
  company_form: 'ab',
  seat: '',
  street: '',
  postal_code: '',
  city: '',
  f_skatt: false,
  vat_period: 'quarterly',
  accounting_method: 'invoice',
  payment_kind: 'bankgiro',
  payment_number: '',
  swish: '',
  contact_email: '',
  contact_phone: '',
  fiscal_year_start: '',
  fiscal_year_end: '',
}
type Form = typeof empty

const texts = [
  ['legal_name', 'Företagsnamn'],
  ['org_number', 'Organisationsnummer'],
  ['seat', 'Säte (kommun)'],
  ['street', 'Gatuadress'],
  ['postal_code', 'Postnummer'],
  ['city', 'Ort'],
  ['payment_number', 'Betalningsnummer'],
  ['swish', 'Swish (valfritt)'],
  ['contact_email', 'E-post (valfritt)'],
  ['contact_phone', 'Telefon (valfritt)'],
] as const

const choices = [
  [
    'vat_period',
    'Momsredovisning',
    { yearly: 'År', quarterly: 'Kvartal', monthly: 'Månad' },
  ],
  [
    'accounting_method',
    'Bokföringsmetod',
    { invoice: 'Fakturametoden', cash: 'Kontantmetoden' },
  ],
  [
    'payment_kind',
    'Betalningssätt',
    { bankgiro: 'Bankgiro', plusgiro: 'Plusgiro', iban: 'IBAN' },
  ],
] as const

function Company() {
  const { orgId } = Route.useParams()
  const url = `/api/v1/orgs/${orgId}/company`
  const mine = usePermissions(orgId)
  const [form, setForm] = useState<Form>()
  const [vat, setVat] = useState<string>()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      const response = await fetch(url)
      const data = response.ok ? company.parse(await response.json()) : null
      setVat(data?.vat_number)
      setForm(
        data
          ? {
              ...data,
              swish: data.swish ?? '',
              contact_email: data.contact_email ?? '',
              contact_phone: data.contact_phone ?? '',
            }
          : empty,
      )
    })()
  }, [url])

  if (mine === null || form === undefined) return <p>Laddar…</p>
  const canEdit = mine.includes('organisation.manage')
  const set = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch })
  }

  async function save(event: SyntheticEvent) {
    event.preventDefault()
    if (!form) return
    const blank = (s: string) => s.trim() || null
    const failed = await call(url, 'PUT', {
      ...form,
      swish: blank(form.swish),
      contact_email: blank(form.contact_email),
      contact_phone: blank(form.contact_phone),
    })
    setError(failed)
    setSaved(!failed)
  }

  return (
    <main>
      <p>
        <a href="/app">Tillbaka</a>
      </p>
      <h1>Företagsuppgifter</h1>
      {vat && <p>Momsregistreringsnummer: {vat}</p>}
      {error && <p role="alert">{error}</p>}
      {saved && <p role="status">Sparat.</p>}
      <form
        onSubmit={(e) => {
          void save(e)
        }}
      >
        <fieldset disabled={!canEdit}>
          <Fields form={form} set={set} />
          {canEdit && <button type="submit">Spara</button>}
        </fieldset>
      </form>
    </main>
  )
}

function Fields(p: { form: Form; set: (patch: Partial<Form>) => void }) {
  const { form, set } = p
  return (
    <>
      {texts.map(([key, label]) => (
        <p key={key}>
          <label>
            {label}
            <input
              value={form[key]}
              required={!label.includes('valfritt')}
              onChange={(e) => {
                set({ [key]: e.target.value })
              }}
            />
          </label>
        </p>
      ))}
      {choices.map(([key, label, options]) => (
        <p key={key}>
          <label>
            {label}
            <select
              value={form[key]}
              onChange={(e) => {
                set({ [key]: e.target.value })
              }}
            >
              {Object.entries(options).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </p>
      ))}
      <p>
        <label>
          <input
            type="checkbox"
            checked={form.f_skatt}
            onChange={(e) => {
              set({ f_skatt: e.target.checked })
            }}
          />{' '}
          Godkänd för F-skatt
        </label>
      </p>
      <p>
        <label>
          Räkenskapsår från
          <input
            type="date"
            required
            value={form.fiscal_year_start}
            onChange={(e) => {
              set({ fiscal_year_start: e.target.value })
            }}
          />
        </label>
      </p>
      <p>
        <label>
          Räkenskapsår till
          <input
            type="date"
            required
            value={form.fiscal_year_end}
            onChange={(e) => {
              set({ fiscal_year_end: e.target.value })
            }}
          />
        </label>
      </p>
    </>
  )
}

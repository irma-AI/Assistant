import { useState } from 'react'
import { z } from 'zod'
import { customerFields, customerFieldText, parseCsv } from '#/api/customers'
import { importResult } from '#/api/schemas'

type Checked = z.infer<typeof importResult>

// Upload, map the columns, check, then save. Nothing is saved while any row is invalid.
export function CsvImport(p: { url: string; onSaved: () => Promise<void> }) {
  const [csv, setCsv] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Checked | null>(null)
  const [error, setError] = useState<string | null>(null)
  const header = csv ? (parseCsv(csv)[0] ?? []) : []

  async function send(commit: boolean) {
    const response = await fetch(p.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csv, mapping, commit }),
    })
    const result = importResult.safeParse(
      await response.json().catch(() => null),
    )
    setError(
      response.ok && result.success
        ? null
        : 'Filen kunde inte läsas. Kontrollera att den är en CSV-fil.',
    )
    setChecked(result.success ? result.data : null)
    if (result.success && result.data.saved) {
      setCsv(null)
      await p.onSaved()
    }
  }

  async function pick(file: File | undefined) {
    setChecked(null)
    setError(null)
    const content = file ? await file.text() : null
    setCsv(content)
    // Preselect the columns whose heading matches a field's label.
    const first = content ? (parseCsv(content)[0] ?? []) : []
    setMapping(
      Object.fromEntries(
        customerFields.flatMap((f) => {
          const hit = first.find(
            (h) =>
              h.toLowerCase() === f ||
              customerFieldText[f].toLowerCase().startsWith(h.toLowerCase()),
          )
          return hit ? [[f, hit]] : []
        }),
      ),
    )
  }

  return (
    <section>
      <h2>Importera kunder</h2>
      <p>
        <label>
          CSV-fil
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
      </p>
      {error && <p role="alert">{error}</p>}
      {csv !== null && (
        <>
          <Mapping
            header={header}
            mapping={mapping}
            onChange={(m) => {
              setChecked(null)
              setMapping(m)
            }}
          />
          <button type="button" onClick={() => void send(false)}>
            Kontrollera filen
          </button>
        </>
      )}
      {checked && <Result checked={checked} onSave={() => void send(true)} />}
    </section>
  )
}

function Mapping(p: {
  header: string[]
  mapping: Record<string, string>
  onChange: (m: Record<string, string>) => void
}) {
  return customerFields.map((f) => (
    <p key={f}>
      <label>
        Kolumn för {customerFieldText[f]}
        <select
          value={p.mapping[f] ?? ''}
          onChange={(e) => {
            p.onChange({ ...p.mapping, [f]: e.target.value })
          }}
        >
          <option value="">(ingen)</option>
          {p.header.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </label>
    </p>
  ))
}

function Result(p: { checked: Checked; onSave: () => void }) {
  const { rows, errors } = p.checked
  return (
    <div role="status">
      <p>{rows} rader lästa.</p>
      <ul>
        {errors.map((e) => (
          <li key={e.row}>
            Rad {e.row}: ogiltigt{' '}
            {e.fields
              .map((f) => customerFieldText[z.enum(customerFields).parse(f)])
              .join(', ')}
          </li>
        ))}
      </ul>
      {!errors.length && rows > 0 && (
        <button type="button" onClick={p.onSave}>
          Spara importen
        </button>
      )}
    </div>
  )
}

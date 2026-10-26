import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { kr, oreOf } from '#/api/money'
import type { receiptList, unmatchedList } from '#/api/schemas'
import { call } from './-call'

type Receipt = (typeof receiptList)['_output'][number]
type Payment = (typeof unmatchedList)['_output'][number]

const paymentText = (p: Payment) =>
  `${p.booking_date} ${p.counterparty ?? 'Okänd mottagare'} ${kr(-p.amount_ore)}`

// What the receipt says, typed in by hand until the app reads receipts itself.
function Fields(p: { r: Receipt; base: string; onSaved: () => Promise<void> }) {
  const { r } = p
  const [form, setForm] = useState({
    supplier: r.supplier ?? '',
    amount: r.amount_ore === null ? '' : String(r.amount_ore / 100),
    date: r.receipt_date ?? '',
    reference: r.reference ?? '',
    giro: r.giro ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set =
    (k: keyof typeof form) => (e: SyntheticEvent<HTMLInputElement>) => {
      setForm({ ...form, [k]: e.currentTarget.value })
    }
  async function save(e: SyntheticEvent) {
    e.preventDefault()
    const amount_ore = form.amount ? oreOf(form.amount) : null
    if (amount_ore === undefined) {
      setError('Beloppet ska vara i kronor, till exempel 125,50.')
      return
    }
    const failed = await call(`${p.base}/${r.id}`, 'PATCH', {
      supplier: form.supplier || null,
      amount_ore,
      receipt_date: form.date || null,
      reference: form.reference || null,
      giro: form.giro || null,
    })
    setError(failed)
    if (!failed) await p.onSaved()
  }
  return (
    <form onSubmit={(e) => void save(e)}>
      <label>
        Leverantör
        <input value={form.supplier} onChange={set('supplier')} />
      </label>
      <label>
        Belopp (kr)
        <input
          inputMode="decimal"
          value={form.amount}
          onChange={set('amount')}
        />
      </label>
      <label>
        Datum
        <input type="date" value={form.date} onChange={set('date')} />
      </label>
      <label>
        Referens
        <input value={form.reference} onChange={set('reference')} />
      </label>
      <label>
        Bankgiro eller plusgiro
        <input value={form.giro} onChange={set('giro')} />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit">Spara uppgifter för {r.name}</button>
    </form>
  )
}

type Props = {
  r: Receipt
  payments: Payment[]
  canManage: boolean
  base: string
  onSaved: () => Promise<void>
}

function MatchRow(p: {
  m: Receipt['matches'][number]
  r: Receipt
  canManage: boolean
  decide: (id: string, verdict: 'confirmed' | 'rejected') => Promise<void>
}) {
  const { m, r } = p
  return (
    <p>
      {m.status === 'confirmed' ? 'Matchad med' : 'Förslag:'}{' '}
      {paymentText(m.transaction)}
      {m.reason && m.confidence !== null && (
        <>
          <br />
          {m.reason}, {Math.round(m.confidence * 100)} % säker.
        </>
      )}
      {m.status === 'suggested' && p.canManage && (
        <>
          <br />
          <button
            type="button"
            onClick={() => void p.decide(m.id, 'confirmed')}
          >
            Godkänn förslaget för {r.name}
          </button>{' '}
          <button
            type="button"
            className="secondary"
            onClick={() => void p.decide(m.id, 'rejected')}
          >
            Avvisa förslaget för {r.name}
          </button>
        </>
      )}
    </p>
  )
}

// A correction: the person picks the payment themselves.
function LinkPicker(p: {
  r: Receipt
  payments: Payment[]
  link: (transactionId: string) => Promise<void>
}) {
  const [chosen, setChosen] = useState('')
  return (
    <p>
      <label>
        Koppla {p.r.name} till en betalning
        <select
          value={chosen}
          onChange={(e) => {
            setChosen(e.target.value)
          }}
        >
          <option value="">Välj betalning</option>
          {p.payments.map((t) => (
            <option key={t.id} value={t.id}>
              {paymentText(t)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!chosen}
        onClick={() => void p.link(chosen)}
      >
        Koppla vald betalning
      </button>
    </p>
  )
}

function Matches(p: Props) {
  const { r } = p
  const [error, setError] = useState<string | null>(null)
  const act = async (url: string, method: string, body: unknown) => {
    const failed = await call(url, method, body)
    setError(failed)
    if (!failed) await p.onSaved()
  }
  return (
    <>
      {r.matches.map((m) => (
        <MatchRow
          key={m.id}
          m={m}
          r={r}
          canManage={p.canManage}
          decide={(id, verdict) =>
            act(`${p.base}/matches/${id}`, 'PUT', { verdict })
          }
        />
      ))}
      {r.suggested_account && (
        <p className="muted">
          Förra gången bokfördes {r.supplier} på {r.suggested_account.number}{' '}
          {r.suggested_account.name}. Inget bokförs förrän du bokför.
        </p>
      )}
      {p.canManage && r.amount_ore !== null && (
        <LinkPicker
          r={r}
          payments={p.payments}
          link={(transactionId) =>
            act(`${p.base}/${r.id}`, 'POST', { transactionId })
          }
        />
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  )
}

export function ReceiptItem(p: Props) {
  return (
    <li className="panel">
      <h2>
        <a
          href={`${p.base.replace('/receipts', '/documents')}/${p.r.document_id}`}
        >
          {p.r.name}
        </a>
      </h2>
      {p.r.mail_context && (
        <p className="muted">Från e-post: {p.r.mail_context}</p>
      )}
      <Fields r={p.r} base={p.base} onSaved={p.onSaved} />
      <Matches {...p} />
    </li>
  )
}

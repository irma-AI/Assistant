import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { z } from 'zod'
import { kr } from '#/api/money'
import { paymentOverview } from '#/api/schemas'
import { call, usePermissions } from './-call'

export const Route = createFileRoute('/app/org/$orgId/fakturor')({
  component: Invoices,
})

type Overview = z.infer<typeof paymentOverview>

type Invoice = Overview['invoices'][number]

function InvoiceItem(props: {
  i: Invoice
  canManage: boolean
  decide: (id: string, verdict: 'confirmed' | 'rejected') => Promise<void>
}) {
  const { i, canManage, decide } = props
  return (
    <li className="panel">
      <h2>
        Faktura {i.number}, {i.customer}
      </h2>
      <p>
        {i.open_ore === 0
          ? `Betald, ${kr(i.total)}.`
          : `${kr(i.open_ore)} kvar av ${kr(i.total)}, förfaller ${i.due_date}.`}
      </p>
      {i.payments.map((p) => (
        <p key={p.id}>
          {p.status === 'confirmed' ? 'Betalning:' : 'Förslag:'}{' '}
          {p.transaction.booking_date}{' '}
          {p.transaction.counterparty ?? 'Okänd betalare'} {kr(p.covers_ore)}
          {p.extra_ore > 0 &&
            `. ${kr(p.extra_ore)} mer än fakturan, betala tillbaka eller behåll som tillgodo`}
          {p.status === 'suggested' && (
            <>
              <br />
              {p.reason}, {Math.round(p.confidence * 100)} % säker. Godkänner du
              bokförs betalningen.
              {canManage && (
                <>
                  <br />
                  <button
                    type="button"
                    onClick={() => void decide(p.id, 'confirmed')}
                  >
                    Godkänn betalningen för faktura {i.number}
                  </button>{' '}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void decide(p.id, 'rejected')}
                  >
                    Avvisa betalningen för faktura {i.number}
                  </button>
                </>
              )}
            </>
          )}
        </p>
      ))}
    </li>
  )
}

function Invoices() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}/payments`
  const mine = usePermissions(orgId)
  const [data, setData] = useState<Overview>()
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const response = await fetch(base)
    const parsed = paymentOverview.safeParse(
      response.ok ? await response.json() : null,
    )
    setData(parsed.success ? parsed.data : { invoices: [], unmatched: [] })
  }, [base])
  useEffect(() => {
    void load()
  }, [load])

  if (mine === null || !data) return <p>Laddar…</p>
  const canManage = mine.includes('invoices.manage')
  async function decide(id: string, verdict: 'confirmed' | 'rejected') {
    const failed = await call(`${base}/${id}`, 'PUT', { verdict })
    setError(failed)
    if (!failed) await load()
  }

  return (
    <main>
      <h1>Fakturor</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {data.invoices.length === 0 && <p>Inga skickade fakturor ännu.</p>}
      <ul>
        {data.invoices.map((i) => (
          <InvoiceItem key={i.id} i={i} canManage={canManage} decide={decide} />
        ))}
      </ul>
      <h2>Inbetalningar som en person måste titta på</h2>
      {data.unmatched.length === 0 && (
        <p>Alla inbetalningar hör till en faktura.</p>
      )}
      <ul>
        {data.unmatched.map((t) => (
          <li key={t.id}>
            {t.booking_date} {t.counterparty ?? 'Okänd betalare'}{' '}
            {kr(t.amount_ore)}
          </li>
        ))}
      </ul>
    </main>
  )
}

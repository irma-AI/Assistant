import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { z } from 'zod'
import { kr } from '#/api/money'
import { receiptList, receiptSettingsView, unmatchedList } from '#/api/schemas'
import { swedishError } from '#/api/permissions'
import { call, useList, usePermissions } from './-call'
import { ReceiptItem } from './-Receipt'

export const Route = createFileRoute('/app/org/$orgId/kvitton')({
  component: Receipts,
})

async function upload(url: string, file: File, source: string) {
  const response = await fetch(
    `${url}?name=${encodeURIComponent(file.name)}&source=${source}`,
    { method: 'POST', body: file },
  )
  if (response.ok) return null
  const body: unknown = await response.json().catch(() => null)
  return swedishError(
    typeof body === 'object' && body && 'error' in body
      ? String(body.error)
      : undefined,
  )
}

function Intake(p: {
  settings: z.infer<typeof receiptSettingsView> | undefined
  canManage: boolean
  onPick: (e: ChangeEvent<HTMLInputElement>, source: string) => Promise<void>
  onToggle: (on: boolean) => Promise<void>
}) {
  const { settings } = p
  return (
    <>
      <p>
        <label>
          Ladda upp kvitto
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => void p.onPick(e, 'upload')}
          />
        </label>
        <label>
          Fota kvitto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void p.onPick(e, 'photo')}
          />
        </label>
      </p>
      {settings?.inbox && (
        <p className="muted">
          Eller mejla kvitton som bilagor till {settings.inbox}. Adressen är
          bara din organisations.
        </p>
      )}
      {settings && p.canManage && (
        <p>
          <label>
            <input
              type="checkbox"
              checked={settings.suggestions}
              onChange={(e) => void p.onToggle(e.target.checked)}
            />
            Föreslå vilken betalning ett kvitto hör till. Du godkänner varje
            förslag själv.
          </label>
        </p>
      )}
    </>
  )
}

function Receipts() {
  const { orgId } = Route.useParams()
  const base = `/api/v1/orgs/${orgId}/receipts`
  const mine = usePermissions(orgId)
  const [receipts, loadReceipts] = useList(base, receiptList)
  const [payments, loadPayments] = useList(`${base}/unmatched`, unmatchedList)
  const [settings, loadSettings] = useSettings(`${base}/settings`)
  const [error, setError] = useState<string | null>(null)

  if (mine === null || !receipts || !payments) return <p>Laddar…</p>
  const canManage = mine.includes('bookkeeping.manage')
  const reload = async () => {
    await Promise.all([loadReceipts(), loadPayments()])
  }

  async function pick(event: ChangeEvent<HTMLInputElement>, source: string) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const failed = await upload(base, file, source)
    setError(failed)
    if (!failed) await reload()
  }

  async function toggle(on: boolean) {
    setError(await call(`${base}/settings`, 'PUT', { suggestions: on }))
    await Promise.all([loadSettings(), reload()])
  }

  return (
    <main>
      <h1>Kvitton</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <Intake
        settings={settings}
        canManage={canManage}
        onPick={pick}
        onToggle={toggle}
      />
      {receipts.length === 0 && <p>Inga kvitton ännu.</p>}
      <ul>
        {receipts.map((r) => (
          <ReceiptItem
            key={r.id}
            r={r}
            payments={payments}
            canManage={canManage}
            base={base}
            onSaved={reload}
          />
        ))}
      </ul>
      <h2>Betalningar utan kvitto</h2>
      {payments.length === 0 && <p>Alla betalningar har kvitto.</p>}
      <ul>
        {payments.map((t) => (
          <li key={t.id}>
            {t.booking_date} {t.counterparty ?? 'Okänd mottagare'}{' '}
            {kr(-t.amount_ore)}
          </li>
        ))}
      </ul>
    </main>
  )
}

function useSettings(url: string) {
  const [settings, setSettings] =
    useState<z.infer<typeof receiptSettingsView>>()
  const load = useCallback(async () => {
    const response = await fetch(url)
    const parsed = receiptSettingsView.safeParse(
      response.ok ? await response.json() : null,
    )
    setSettings(parsed.success ? parsed.data : undefined)
  }, [url])
  useEffect(() => {
    void load()
  }, [load])
  return [settings, load] as const
}

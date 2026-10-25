import { useEffect, useRef } from 'react'
import { renderSVG } from 'uqr'
import { countdownAnnouncement, countdownText } from './-bankid'

const qrImage = (qr: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(qr))}`

// BankID shows "Mer tid" once 30 seconds of the QR display remain (docs/plans/IRM-161.md).
const extendFrom = 30

// The animated QR code with BankID's accessibility rules: a full-screen button, a countdown
// read aloud only at key points, and "Mer tid" by button or space bar.
export function QrCode({
  qr,
  remaining,
  big,
  toggleBig,
  extend,
}: {
  qr: string
  remaining: number
  big: boolean
  toggleBig: () => void
  extend: () => Promise<void>
}) {
  const qrButton = useRef<HTMLButtonElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const offerMore = remaining <= extendFrom

  const more = async () => {
    await extend()
    qrButton.current?.focus()
  }

  // Space extends wherever focus is, except where space already types or presses something else.
  useEffect(() => {
    if (!offerMore) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null
      const own = target === qrButton.current || target === moreButton.current
      if (
        e.key !== ' ' ||
        (!own && target?.closest('input, textarea, select, button, a'))
      )
        return
      e.preventDefault()
      void more()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  })

  return (
    <>
      <button
        ref={qrButton}
        type="button"
        className={big ? 'qr qr-full' : 'qr'}
        aria-label={
          big
            ? 'QR-kod, skanna på armlängds avstånd. Tryck för att lämna helskärm.'
            : 'QR-kod, skanna på armlängds avstånd. Tryck för helskärm.'
        }
        onClick={() => {
          toggleBig()
          ;(moreButton.current ?? qrButton.current)?.focus()
        }}
      >
        <img src={qrImage(qr)} alt="" />
      </button>
      <p aria-hidden="true">Tid kvar: {countdownText(remaining)}</p>
      <p className="visually-hidden" aria-live="polite">
        {countdownAnnouncement(remaining)}
      </p>
      {offerMore && (
        <p>
          <button ref={moreButton} type="button" onClick={() => void more()}>
            Mer tid
          </button>
        </p>
      )}
    </>
  )
}

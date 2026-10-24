import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  cancelLogin,
  expiredMessage,
  failedMessage,
  isTestMode,
  poll,
  startLogin,
} from './-bankid'
import { isMobile } from './-isMobile'

type Phase =
  | { name: 'idle'; message?: string }
  | { name: 'qr'; qr?: string; message?: string }

export function useLogin() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [big, setBig] = useState(false)
  const [nonce, setNonce] = useState<string>()
  const [testMode, setTestMode] = useState(false)
  const waiting = phase.name === 'qr'

  useEffect(() => {
    isTestMode().then(setTestMode, () => undefined)
  }, [])

  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      poll(nonce).then(
        (next) => {
          if (next.status === 'complete') {
            void navigate({ to: '/app' })
          } else if (next.status === 'pending') {
            setPhase((prev) => ({
              name: 'qr',
              qr: next.qr,
              // The server answers without a message while it throttles collect; keep the last one.
              message:
                next.message || (prev.name === 'qr' ? prev.message : undefined),
            }))
          } else {
            setBig(false)
            setPhase({
              name: 'idle',
              message: next.status === 'failed' ? next.message : expiredMessage,
            })
          }
        },
        () => undefined,
      )
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [waiting, nonce, navigate])

  const fail = () => {
    setPhase({ name: 'idle', message: failedMessage })
  }

  return {
    phase,
    big,
    testMode,
    sameDeviceWaiting: nonce !== undefined,
    toggleBig: () => {
      setBig(!big)
    },
    sameDevice: async () => {
      try {
        const started = await startLogin(true)
        setNonce(started.nonce)
        // The BankID app returns to /app/login/return, which finishes the login.
        // BankID's autostart guide: the app link on mobile, the bankid scheme on desktop.
        const mobile = isMobile(navigator.userAgent, navigator.maxTouchPoints)
        const link = document.createElement('a')
        link.href = `${mobile ? 'https://app.bankid.com/' : 'bankid:///'}?autostarttoken=${started.autoStartToken ?? ''}`
        link.referrerPolicy = 'origin'
        link.click()
        // On desktop the browser stays here, so show the pending state while the app signs.
        setPhase({ name: 'qr', message: 'Försöker starta BankID-appen.' })
      } catch {
        fail()
      }
    },
    otherDevice: async () => {
      try {
        await startLogin(false)
        setNonce(undefined)
        setPhase({ name: 'qr' })
      } catch {
        fail()
      }
    },
    cancel: async () => {
      await cancelLogin().catch(() => undefined)
      setBig(false)
      setPhase({ name: 'idle' })
    },
  }
}

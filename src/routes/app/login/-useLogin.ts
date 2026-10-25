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

// BankID's autostart guide: the app link on mobile, the bankid scheme on desktop.
function launchBankId(token: string) {
  const mobile = isMobile(navigator.userAgent, navigator.maxTouchPoints)
  const link = document.createElement('a')
  link.href = `${mobile ? 'https://app.bankid.com/' : 'bankid:///'}?autostarttoken=${token}`
  link.referrerPolicy = 'origin'
  link.click()
}

export function useLogin() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [big, setBig] = useState(false)
  const [sameDeviceTab, setSameDeviceTab] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const waiting = phase.name === 'qr'

  useEffect(() => void isTestMode().then(setTestMode, () => undefined), [])

  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      poll().then(
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
          } else if (next.status === 'expired' && sameDeviceTab) {
            // The return tab finished the login and removed the attempt.
            void navigate({ to: '/app' })
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
  }, [waiting, sameDeviceTab, navigate])

  const fail = (e: unknown) => {
    setPhase({
      name: 'idle',
      message: e instanceof Error ? e.message : failedMessage,
    })
  }

  return {
    phase,
    big,
    testMode,
    sameDeviceWaiting: sameDeviceTab,
    toggleBig: () => {
      setBig(!big)
    },
    sameDevice: async () => {
      try {
        const started = await startLogin(true)
        setSameDeviceTab(true)
        launchBankId(started.autoStartToken ?? '')
        // On desktop the browser stays here, so show the pending state while the app signs.
        setPhase({ name: 'qr', message: 'Försöker starta BankID-appen.' })
      } catch (e) {
        fail(e)
      }
    },
    otherDevice: async () => {
      try {
        await startLogin(false)
        setSameDeviceTab(false)
        setPhase({ name: 'qr' })
      } catch (e) {
        fail(e)
      }
    },
    cancel: async () => {
      await cancelLogin().catch(() => undefined)
      setBig(false)
      setPhase({ name: 'idle' })
    },
  }
}

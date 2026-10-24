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

type Phase =
  | { name: 'idle'; message?: string }
  | { name: 'qr'; qr?: string; message?: string }

export function useLogin() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [big, setBig] = useState(false)
  const [testMode, setTestMode] = useState(false)
  const waiting = phase.name === 'qr'

  useEffect(() => {
    isTestMode().then(setTestMode, () => undefined)
  }, [])

  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(() => {
      poll().then(
        (next) => {
          if (next.status === 'complete') {
            void navigate({ to: '/app' })
          } else if (next.status === 'pending') {
            setPhase({ name: 'qr', qr: next.qr, message: next.message })
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
  }, [waiting, navigate])

  const fail = () => {
    setPhase({ name: 'idle', message: failedMessage })
  }

  return {
    phase,
    big,
    testMode,
    toggleBig: () => {
      setBig(!big)
    },
    sameDevice: async () => {
      try {
        const { autoStartToken } = await startLogin(true)
        // The BankID app returns to /app/login/return, which finishes the login.
        // BankID's autostart guide: the app link on mobile, the bankid scheme on desktop.
        const mobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent)
        const link = document.createElement('a')
        link.href = `${mobile ? 'https://app.bankid.com/' : 'bankid:///'}?autostarttoken=${autoStartToken ?? ''}`
        link.referrerPolicy = 'origin'
        link.click()
      } catch {
        fail()
      }
    },
    otherDevice: async () => {
      try {
        await startLogin(false)
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

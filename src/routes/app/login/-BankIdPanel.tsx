import type { Purpose } from './-bankid'
import { QrCode } from './-QrCode'
import { useLogin } from './-useLogin'

// The BankID steps shared by logging in and confirming an account deletion.
export function BankIdPanel({
  purpose,
  verb,
  loggedIn,
}: {
  purpose: Purpose
  verb: string
  // Replaces the move to /app when a login completes.
  loggedIn?: () => void
}) {
  const {
    phase,
    big,
    testMode,
    sameDeviceWaiting,
    toggleBig,
    sameDevice,
    otherDevice,
    extend,
    cancel,
  } = useLogin(purpose, loggedIn)

  return (
    <>
      {testMode && (
        <p role="status">Testmiljö – inloggningen är inte verifierad</p>
      )}
      {phase.name === 'idle' ? (
        <>
          {phase.message && <p role="alert">{phase.message}</p>}
          <p>
            <button type="button" onClick={() => void sameDevice()}>
              {verb} med BankID på den här enheten
            </button>
          </p>
          <p>
            <button type="button" onClick={() => void otherDevice()}>
              {verb} med BankID på en annan enhet
            </button>
          </p>
        </>
      ) : (
        <>
          {!sameDeviceWaiting && (
            <p>Öppna BankID-appen på din andra enhet och skanna QR-koden.</p>
          )}
          {phase.message && <p role="status">{phase.message}</p>}
          {phase.qr && (
            <QrCode
              qr={phase.qr}
              remaining={phase.remaining ?? 0}
              big={big}
              toggleBig={toggleBig}
              extend={extend}
            />
          )}
          <p>
            <button type="button" onClick={() => void cancel()}>
              Avbryt
            </button>
          </p>
        </>
      )}
    </>
  )
}

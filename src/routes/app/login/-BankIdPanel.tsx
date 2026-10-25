import { renderSVG } from 'uqr'
import type { Purpose } from './-bankid'
import { useLogin } from './-useLogin'

const qrImage = (qr: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(qr))}`

// The BankID steps shared by logging in and confirming an account deletion.
export function BankIdPanel({
  purpose,
  verb,
}: {
  purpose: Purpose
  verb: string
}) {
  const {
    phase,
    big,
    testMode,
    sameDeviceWaiting,
    toggleBig,
    sameDevice,
    otherDevice,
    cancel,
  } = useLogin(purpose)

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
            <button
              type="button"
              className={big ? 'qr qr-full' : 'qr'}
              aria-label={
                big ? 'Visa QR-koden mindre' : 'Visa QR-koden i helskärm'
              }
              onClick={() => {
                toggleBig()
              }}
            >
              <img src={qrImage(phase.qr)} alt="QR-kod för BankID-inloggning" />
            </button>
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

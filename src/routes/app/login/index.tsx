import { createFileRoute } from '@tanstack/react-router'
import { renderSVG } from 'uqr'
import { useLogin } from './-useLogin'

export const Route = createFileRoute('/app/login/')({ component: Login })

const qrImage = (qr: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(renderSVG(qr))}`

function Login() {
  const { phase, big, testMode, toggleBig, sameDevice, otherDevice, cancel } =
    useLogin()

  return (
    <main>
      {testMode && (
        <p role="status">Testmiljö – inloggningen är inte verifierad</p>
      )}
      <h1>Logga in</h1>
      {phase.name === 'idle' ? (
        <>
          {phase.message && <p role="alert">{phase.message}</p>}
          <p>
            <button type="button" onClick={() => void sameDevice()}>
              Logga in med BankID på den här enheten
            </button>
          </p>
          <p>
            <button type="button" onClick={() => void otherDevice()}>
              Logga in med BankID på en annan enhet
            </button>
          </p>
        </>
      ) : (
        <>
          <p>Öppna BankID-appen på din andra enhet och skanna QR-koden.</p>
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
      <p>
        <a href="/integritet">Integritetspolicy</a>
      </p>
    </main>
  )
}

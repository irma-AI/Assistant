import type { Purpose } from './-bankid'
import { isMobile } from './-isMobile'
import { QrCode } from './-QrCode'
import { useLogin } from './-useLogin'

const TestNotice = () => (
  <p role="status" className="notice">
    Testmiljö – inloggningen är inte verifierad
  </p>
)

// The likely path for this device is the Cable light pill; the other is secondary.
function Choices({
  verb,
  quiet,
  sameDevice,
  otherDevice,
}: {
  verb: string
  quiet?: boolean
  sameDevice: () => Promise<void>
  otherDevice: () => Promise<void>
}) {
  const mobile = isMobile(navigator.userAgent, navigator.maxTouchPoints)
  const primary = (first: boolean) =>
    quiet || !first ? 'secondary' : undefined
  const same = (
    <button
      key="same"
      type="button"
      className={primary(mobile)}
      onClick={() => void sameDevice()}
    >
      {verb} med BankID på den här enheten
    </button>
  )
  const other = (
    <button
      key="other"
      type="button"
      className={primary(!mobile)}
      onClick={() => void otherDevice()}
    >
      {verb} med BankID på en annan enhet
    </button>
  )
  return (
    <>
      <p className="muted">
        {mobile
          ? 'BankID-appen öppnas på den här enheten. När du är klar kommer du tillbaka hit.'
          : 'Du skannar en QR-kod med BankID-appen på din andra enhet. När du är klar loggas du in här.'}
      </p>
      <div className="actions">{mobile ? [same, other] : [other, same]}</div>
    </>
  )
}

// The BankID steps shared by logging in and confirming an account deletion.
export function BankIdPanel({
  purpose,
  verb,
  loggedIn,
  quiet,
}: {
  purpose: Purpose
  verb: string
  // Replaces the move to /app when a login completes.
  loggedIn?: () => void
  // A destructive purpose gets no prominent button.
  quiet?: boolean
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
      {testMode && <TestNotice />}
      {phase.name === 'idle' ? (
        <>
          {phase.message && <p role="alert">{phase.message}</p>}
          <Choices
            verb={verb}
            quiet={quiet}
            sameDevice={sameDevice}
            otherDevice={otherDevice}
          />
        </>
      ) : (
        <>
          {sameDeviceWaiting ? (
            <p>
              BankID-appen öppnas… Följ stegen i appen. Därefter kommer du
              tillbaka hit.
            </p>
          ) : (
            <p>
              Skanna QR-koden med BankID-appen på din andra enhet. Därefter
              loggas du in här.
            </p>
          )}
          {phase.message && <p role="status">{phase.message}</p>}
          {sameDeviceWaiting && (
            <p>
              Öppnades BankID i en annan webbläsare? Avbryt och välj BankID på
              en annan enhet, så loggar du in med QR-kod i stället.
            </p>
          )}
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
            <button
              type="button"
              className="secondary"
              onClick={() => void cancel()}
            >
              Avbryt
            </button>
          </p>
        </>
      )}
    </>
  )
}

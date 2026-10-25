import { createFileRoute } from '@tanstack/react-router'
import { BankIdPanel } from './login/-BankIdPanel'

// Also the public web address for deleting an account, which Google Play's Data safety form asks for.
export const Route = createFileRoute('/app/radera-konto')({
  validateSearch: (search) => ({ raderat: search.raderat === true }),
  component: DeleteAccount,
})

function DeleteAccount() {
  const { raderat } = Route.useSearch()
  return (
    <main>
      <h1>Radera mitt konto</h1>
      {raderat ? (
        <p role="status">Ditt konto är raderat.</p>
      ) : (
        <>
          <p>
            Vi raderar ditt konto direkt: personnummer, sessioner och
            inloggningar. Du loggas ut överallt.
          </p>
          <p>
            Ditt namn finns kvar på bokföringsposter du har gjort, så länge
            bokföringslagen kräver det. Säkerhetskopior förfaller enligt{' '}
            <a href="/integritetspolicy">integritetspolicyn</a>.
          </p>
          <p>Bekräfta med BankID att du vill radera kontot.</p>
          <BankIdPanel purpose="delete" verb="Radera mitt konto" />
        </>
      )}
    </main>
  )
}

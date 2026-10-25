import { createFileRoute } from '@tanstack/react-router'
import { BankIdPanel } from './-BankIdPanel'

export const Route = createFileRoute('/app/login/')({ component: Login })

function Login() {
  return (
    <main>
      <h1>Logga in</h1>
      <BankIdPanel purpose="login" verb="Logga in" />
      <p>
        <a href="/integritetspolicy">Integritetspolicy</a>
      </p>
    </main>
  )
}

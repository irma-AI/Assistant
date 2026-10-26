import { createFileRoute } from '@tanstack/react-router'
import { BankIdPanel } from './-BankIdPanel'

export const Route = createFileRoute('/app/login/')({ component: Login })

function Login() {
  return (
    <main>
      <p className="company">Redo</p>
      <h1>Logga in</h1>
      <div className="panel">
        <BankIdPanel purpose="login" verb="Logga in" />
      </div>
      <p>
        <a href="/app/login/demo">Demokonto</a> ·{' '}
        <a href="/integritetspolicy">Integritetspolicy</a>
      </p>
    </main>
  )
}

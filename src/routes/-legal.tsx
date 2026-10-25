import type { ReactNode } from 'react'

// Shown until the owner fills in the controller's details (IRM-54).
export const controller =
  '[PLATSHÅLLARE: företagsnamn, organisationsnummer, kontaktadress]'

export function Legal({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main>
      <p>
        <a href="/">Till startsidan</a>
      </p>
      <h1>{title}</h1>
      {children}
      <nav aria-label="Juridisk information">
        <a href="/integritetspolicy">Integritetspolicy</a>{' '}
        <a href="/villkor">Villkor</a>{' '}
        <a href="/personuppgiftsbitradesavtal">Personuppgiftsbiträdesavtal</a>
      </nav>
    </main>
  )
}

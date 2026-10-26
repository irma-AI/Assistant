import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export type Tab = 'hem' | 'organisation' | 'konto'

// The tab a path belongs to; screens below a tab keep it marked.
export function tabOf(pathname: string): Tab | undefined {
  if (pathname === '/app') return 'hem'
  if (pathname.startsWith('/app/org')) return 'organisation'
  if (pathname.startsWith('/app/konto') || pathname === '/app/installningar')
    return 'konto'
  return undefined
}

const icon = (paths: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {paths}
  </svg>
)

export function TabBar({ active }: { active: Tab | undefined }) {
  // Exact, so Hem isn't marked on every screen; the tab also stays marked on screens below it.
  const props = (tab: Tab) => ({
    activeOptions: { exact: true },
    'aria-current': active === tab ? ('page' as const) : undefined,
  })
  return (
    <nav className="tabbar" aria-label="Huvudmeny">
      <Link to="/app" {...props('hem')}>
        {icon(<path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6" />)}
        Hem
      </Link>
      <Link to="/app/organisation" {...props('organisation')}>
        {icon(
          <path d="M4 20V5h10v15M14 10h6v10M8 9h2M8 13h2M8 17h2M4 20h16" />,
        )}
        Organisation
      </Link>
      <Link to="/app/konto" {...props('konto')}>
        {icon(
          <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </>,
        )}
        Konto
      </Link>
    </nav>
  )
}

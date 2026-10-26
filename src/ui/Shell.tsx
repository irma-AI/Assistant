import { Link, Outlet, useLocation, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { TabBar, tabOf } from './TabBar'
import { ShellContext } from './shellContext'
import type { ShellState } from './shellContext'
import { recall, remember } from './storage'

const orgKey = 'redo.org'

// Screens a person reaches without being logged in, or that are a task of their own.
const outside = [
  '/app/login',
  '/app/radera-konto',
  '/app/invite',
  '/app/bekrafta-epost',
]

export function isOutside(pathname: string) {
  return outside.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

const tabRoots = ['/app', '/app/organisation', '/app/konto']

export function Shell({ orgs }: { orgs: ShellState['orgs'] }) {
  const { pathname } = useLocation()
  const router = useRouter()
  const [chosen, setChosen] = useState(recall(orgKey))

  const state: ShellState = {
    orgs,
    active: orgs.find((o) => o.id === chosen) ?? orgs[0],
    choose: (id) => {
      remember(orgKey, id)
      setChosen(id)
    },
    reload: () => router.invalidate(),
  }
  const path = pathname.replace(/\/$/, '') || '/app'
  const below = !tabRoots.includes(path)
  const parent = tabOf(path) === 'konto' ? '/app/konto' : '/app/organisation'
  return (
    <ShellContext value={state}>
      <div className="shell-body">
        {below && (
          <header className="topbar">
            <Link to={parent}>← Tillbaka</Link>
          </header>
        )}
        <Outlet />
      </div>
      <TabBar active={tabOf(path)} />
    </ShellContext>
  )
}

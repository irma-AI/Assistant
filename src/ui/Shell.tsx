import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { organisations } from '#/api/schemas'
import { TabBar, tabOf } from './TabBar'
import { ShellContext } from './shellContext'
import type { ShellState } from './shellContext'
import { recall, remember, rememberNext } from './storage'

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

export function Shell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<ShellState['orgs']>()
  const [chosen, setChosen] = useState(recall(orgKey))

  const reload = useCallback(async () => {
    const response = await fetch('/api/v1/orgs')
    if (response.ok) {
      setOrgs(organisations.parse(await response.json()))
      return
    }
    // Not logged in: go to login, and come back here afterwards.
    rememberNext(location.pathname + location.search)
    await navigate({ to: '/app/login' })
  }, [navigate])
  useEffect(() => {
    void reload()
  }, [reload])

  if (!orgs) return <p role="status">Laddar…</p>

  const state: ShellState = {
    orgs,
    active: orgs.find((o) => o.id === chosen) ?? orgs[0],
    choose: (id) => {
      remember(orgKey, id)
      setChosen(id)
    },
    reload,
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

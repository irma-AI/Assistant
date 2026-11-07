import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { organisations } from '#/api/schemas'
import { rememberNext } from '#/ui/storage'
import { Shell, isOutside } from '#/ui/Shell'

export const Route = createFileRoute('/app')({
  ssr: false,
  loader: async ({ location }) => {
    if (isOutside(location.pathname)) return undefined
    const response = await fetch('/api/v1/orgs')
    if (response.ok) return organisations.parse(await response.json())
    // Not logged in: go to login, and come back here afterwards.
    rememberNext(location.pathname + location.searchStr)
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- the router's redirect() is thrown on purpose to leave a loader
    throw redirect({ to: '/app/login' })
  },
  pendingComponent: () => <p>Laddar…</p>,
  component: Layout,
})

function Layout() {
  const { pathname } = useLocation()
  const orgs = Route.useLoaderData()
  const router = useRouter()
  const outside = isOutside(pathname)
  // The loader skipped the list on an outside screen (before login), so fetch it now.
  useEffect(() => {
    if (!outside && !orgs) void router.invalidate()
  }, [outside, orgs, router])
  if (outside) return <Outlet />
  return orgs ? <Shell orgs={orgs} /> : <p role="status">Laddar…</p>
}

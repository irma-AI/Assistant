import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router'
import { Shell, isOutside } from '#/ui/Shell'

export const Route = createFileRoute('/app')({
  ssr: false,
  pendingComponent: () => <p>Laddar…</p>,
  component: Layout,
})

function Layout() {
  const { pathname } = useLocation()
  return isOutside(pathname) ? <Outlet /> : <Shell />
}

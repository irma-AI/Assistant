import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  ssr: false,
  pendingComponent: () => <p>Laddar…</p>,
  component: Outlet,
})

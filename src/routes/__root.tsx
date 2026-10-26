import { useEffect } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouter,
} from '@tanstack/react-router'

import { ApiError } from '#/api/client'
import { reportThrown } from '#/api/clientErrors'
import { apiBaseUrl } from '#/platform/api'
import { pageRequestId } from '#/api/requestId'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Redo',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main>
      <h1>Sidan finns inte</h1>
      <p>
        Adressen stämmer inte, eller så har sidan flyttats.{' '}
        <a href="/app">Till startsidan</a>
      </p>
    </main>
  ),
  errorComponent: RootError,
  shellComponent: RootDocument,
})

function RootError({ error }: ErrorComponentProps) {
  const router = useRouter()
  useEffect(() => {
    reportThrown(error, currentRoute(router), apiBaseUrl())
  }, [error, router])
  const id = (error instanceof ApiError && error.requestId) || pageRequestId()
  return (
    <main>
      <h1>Något gick fel</h1>
      <p>
        Försök igen. Om felet kommer tillbaka, uppge felkoden{' '}
        {id ? <code>{id}</code> : null}
        <a href="/app">Till startsidan</a>
      </p>
    </main>
  )
}

// The pattern of the deepest matched route, never the raw path, which can hold a token.
const currentRoute = (router: ReturnType<typeof useRouter>) =>
  router.state.matches.at(-1)?.fullPath.replaceAll('$', ':') ?? 'unmatched'

// Errors that no component catches: a thrown event handler, a rejected promise.
function ReportErrors() {
  const router = useRouter()
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      reportThrown(e.error ?? e.message, currentRoute(router), apiBaseUrl())
    }
    const onRejection = (e: PromiseRejectionEvent) => {
      reportThrown(e.reason, currentRoute(router), apiBaseUrl())
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [router])
  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <ReportErrors />

        <Scripts />
      </body>
    </html>
  )
}

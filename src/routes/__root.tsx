import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { ApiError } from '#/api/client'
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
  errorComponent: ({ error }) => {
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
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}

        <Scripts />
      </body>
    </html>
  )
}

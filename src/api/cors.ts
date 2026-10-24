// The Capacitor web views' origins: iOS and Android. The same in every environment.
const allowedOrigins = new Set(['capacitor://localhost', 'https://localhost'])

const corsHeaders = (origin: string) => ({
  'access-control-allow-origin': origin,
  vary: 'Origin',
})

/** The answer to a preflight, or undefined when the request is not one. */
export function preflight(request: Request) {
  const origin = request.headers.get('origin')
  if (request.method !== 'OPTIONS' || origin === null) return undefined
  if (!allowedOrigins.has(origin)) return new Response(null, { status: 403 })
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': '600',
    },
  })
}

/** The response with CORS headers when an allowed origin asked, errors included. Same-origin calls pass untouched. */
export function withCors(request: Request, response: Response) {
  const origin = request.headers.get('origin')
  if (origin === null || !allowedOrigins.has(origin)) return response
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(corsHeaders(origin)))
    headers.append(name, value)
  return new Response(response.body, { status: response.status, headers })
}

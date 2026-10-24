const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

// The app's own address, one variable per environment. Never built from request headers.
export const publicUrl = () => process.env.PUBLIC_URL ?? 'http://localhost:3000'

/** A 403 for a state-changing request that carries cookies but does not come from our own origin. */
export function csrfBlock(request: Request) {
  if (safeMethods.has(request.method) || !request.headers.has('cookie'))
    return undefined
  if (request.headers.get('origin') === new URL(publicUrl()).origin)
    return undefined
  return Response.json({ error: 'forbidden' }, { status: 403 })
}

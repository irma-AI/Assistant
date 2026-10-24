const meta = '<meta name="robots" content="noindex">'

/** Outside production, keeps a page response out of search engines: the header, and the meta tag in an HTML head. */
export function withNoindex(response: Response) {
  if (process.env.APP_ENV === 'production') return response
  const headers = new Headers(response.headers)
  headers.set('x-robots-tag', 'noindex')
  if (!headers.get('content-type')?.includes('text/html'))
    return new Response(response.body, { status: response.status, headers })
  // shortcut: assumes the first chunk holds <head>, true for Start's shell; upgrade if the document shell changes.
  let done = false
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const body = response.body?.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (done) {
          controller.enqueue(chunk)
          return
        }
        done = true
        controller.enqueue(
          encoder.encode(
            decoder
              .decode(chunk, { stream: true })
              .replace('<head>', `<head>${meta}`),
          ),
        )
      },
    }),
  )
  return new Response(body, { status: response.status, headers })
}

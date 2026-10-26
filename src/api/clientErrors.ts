type Report = { name: string; message: string; stack: string; route: string }

// Sends one unhandled error to the log endpoint; a failure to report is dropped, never reported again.
// baseUrl is relative here; the native apps pass an absolute one.
export function reportClientError(r: Report, baseUrl: string) {
  void fetch(`${baseUrl}/api/v1/client-errors`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...r,
      version: String(import.meta.env.VITE_APP_VERSION ?? 'dev'),
    }),
    keepalive: true,
  }).catch(() => undefined)
}

export function reportThrown(e: unknown, route: string, baseUrl: string) {
  const err = e instanceof Error ? e : new Error(String(e))
  reportClientError(
    {
      name: err.name,
      message: err.message,
      stack: err.stack ?? '',
      route,
    },
    baseUrl,
  )
}

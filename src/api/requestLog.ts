/** One JSON log line for an API request. Pathname only: a query string can carry tokens. */
export function requestLine(
  request: Request,
  status: number,
  durationMs: number,
) {
  // shortcut: logs the raw pathname, safe while no API route has path params; log the route pattern once one does (IRM-137).
  return JSON.stringify({
    time: new Date().toISOString(),
    level: status >= 500 ? 'error' : 'info',
    event: 'http_request',
    method: request.method,
    path: new URL(request.url).pathname,
    status,
    duration_ms: Math.round(durationMs),
  })
}

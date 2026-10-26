/** The id of the request that loaded this page (the server sends it as Server-Timing), for the error screen. */
export function pageRequestId() {
  for (const entry of performance.getEntriesByType('navigation'))
    if (entry instanceof PerformanceNavigationTiming)
      return entry.serverTiming.find((t) => t.name === 'request')?.description
  return undefined
}

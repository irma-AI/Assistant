import { getRouter } from './router'

let router: ReturnType<typeof getRouter> | undefined

/** The matched route's pattern, such as /api/v1/invites/:token; never the raw path, which can hold a token. */
export function routePattern(pathname: string) {
  router ??= getRouter()
  const [, , found] = router.getMatchedRoutes(pathname)
  return found ? String(found.fullPath).replaceAll('$', ':') : 'unmatched'
}

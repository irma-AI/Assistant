// A screen revisited within this long comes from the router's cache; a change (router.invalidate) still reloads it at once.
const freshFor = 30_000
const checkedAt = new Map<string, number>()

// For a route's `shouldReload`, which the router asks only about data it already holds.
// shortcut: the clock starts at the first revisit, not at the load, so data can be up to twice this old, upgrade when a screen needs exact freshness.
export function isOld(key: string) {
  const now = Date.now()
  const old = now - (checkedAt.get(key) ?? now) > freshFor
  if (old || !checkedAt.has(key)) checkedAt.set(key, now)
  return old
}

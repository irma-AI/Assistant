// localStorage can throw (private windows, blocked site data), and the app works without it.
export function remember(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not remembered; the person lands on the default next time.
  }
}

export function recall(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const nextKey = 'redo.next'

// Where a logged-out visit was headed, so login can return there.
export function rememberNext(path: string) {
  remember(nextKey, path)
}

export function takeNext() {
  const path = recall(nextKey)
  remember(nextKey, null)
  // Only a path inside the app; never another site.
  return path && /^\/app(\/(?!\/)|$)/.test(path) ? path : '/app'
}

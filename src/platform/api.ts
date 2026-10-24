import { z } from 'zod'

import { isNative } from './native'

// Absolute on native, where the page's own origin is capacitor://localhost; relative on the web.
export function apiBaseUrl() {
  return isNative() ? z.url().parse(import.meta.env.VITE_API_ORIGIN) : ''
}

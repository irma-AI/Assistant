import { createContext, useContext } from 'react'
import type { z } from 'zod'
import type { organisations } from '#/api/schemas'

type Orgs = z.infer<typeof organisations>

export type ShellState = {
  orgs: Orgs
  // The organisation chosen on this device, else the first; undefined without any.
  active: Orgs[number] | undefined
  choose: (id: string) => void
  reload: () => Promise<void>
}

export const ShellContext = createContext<ShellState | undefined>(undefined)

export function useShell() {
  const state = useContext(ShellContext)
  if (!state) throw new Error('useShell outside the app shell')
  return state
}

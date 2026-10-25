import { useCallback, useEffect, useState } from 'react'
import type { z } from 'zod'
import { errorBody } from '#/api/schemas'
import { swedishError } from '#/api/permissions'

// Sends a request and returns null on success or the Swedish reason it failed.
export async function call(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.ok) return null
  const parsed = errorBody.safeParse(await response.json().catch(() => null))
  return swedishError(parsed.success ? parsed.data.error : undefined)
}

// The signed-in member's permissions here; null until known.
export function usePermissions(orgId: string) {
  const [permissions, setPermissions] = useState<string[] | null>(null)
  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/v1/orgs/${orgId}/me`)
      const body: unknown = await response.json().catch(() => null)
      const list =
        response.ok && typeof body === 'object' && body && 'permissions' in body
          ? body.permissions
          : []
      setPermissions(Array.isArray(list) ? list.map(String) : [])
    })()
  }, [orgId])
  return permissions
}

// A list fetched from the API; undefined until loaded, empty when the request fails.
export function useList<T extends z.ZodArray>(url: string, schema: T) {
  const [list, setList] = useState<z.infer<T>>()
  const load = useCallback(async () => {
    const response = await fetch(url)
    setList(schema.parse(response.ok ? await response.json() : []))
  }, [url, schema])
  useEffect(() => {
    void load()
  }, [load])
  return [list, load] as const
}

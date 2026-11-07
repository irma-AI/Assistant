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

// The signed-in member's permissions here; empty when the request fails.
export async function fetchPermissions(orgId: string) {
  const response = await fetch(`/api/v1/orgs/${orgId}/me`)
  const body: unknown = await response.json().catch(() => null)
  const list =
    response.ok && typeof body === 'object' && body && 'permissions' in body
      ? body.permissions
      : []
  return Array.isArray(list) ? list.map(String) : []
}

// A list fetched from the API; empty when the request fails.
export async function fetchList<T extends z.ZodArray>(url: string, schema: T) {
  const response = await fetch(url)
  return schema.parse(response.ok ? await response.json() : [])
}

// JSON from the API for a screen that cannot show anything without it; a failure reaches the route's error screen.
export async function fetchJson<T extends z.ZodType>(url: string, schema: T) {
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`${url} answered ${String(response.status)}`)
  return schema.parse(await response.json())
}

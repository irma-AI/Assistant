import { z } from 'zod'

export const errorBody = z.object({ error: z.string() })

export const me = z.object({ id: z.string() })

export const permission = z.enum([
  'organisation.manage',
  'members.manage',
  'roles.manage',
])

export const newOrganisation = z.object({
  name: z.string().trim().min(1).max(100),
})
export const newRole = z.object({
  name: z.string().trim().min(1).max(50),
  permissions: z.array(permission),
})
export const roleEdit = newRole.partial()
export const roleChange = z.object({ roleId: z.uuid() })

export const organisations = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    role: z.string(),
    owners: z.number(),
  }),
)

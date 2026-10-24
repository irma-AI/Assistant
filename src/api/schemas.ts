import { z } from 'zod'

export const errorBody = z.object({ error: z.string() })

export const me = z.object({ id: z.string() })

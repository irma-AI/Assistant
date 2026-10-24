import type { errorBody } from '#/api/schemas'
import type { z } from 'zod'

// shortcut: rejects every request, because there is no session store yet; IRM-87 verifies the bearer token here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the signature IRM-87 fills in, so endpoints don't change
export function requireSession(_request: Request) {
  const body: z.infer<typeof errorBody> = { error: 'unauthorized' }
  return Response.json(body, { status: 401 })
}

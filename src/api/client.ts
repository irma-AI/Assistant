import { errorBody, me } from './schemas'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// baseUrl is relative here; the native apps pass an absolute one.
export async function getMe(token: string, baseUrl = '') {
  const response = await fetch(`${baseUrl}/api/v1/me`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok)
    throw new ApiError(
      response.status,
      errorBody.parse(await response.json()).error,
    )
  return me.parse(await response.json())
}

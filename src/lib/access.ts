import type { NextRequest } from 'next/server'

/**
 * Optional shared access code. If ACCESS_CODE is set on the server, every API call must send it
 * in the `x-access-code` header. This keeps a deployed URL (and the server-side Google key behind
 * it) from being used by anyone who finds the link.
 */
export function accessDenied(req: NextRequest): Response | null {
  const required = process.env.ACCESS_CODE
  if (!required) return null
  if (req.headers.get('x-access-code') === required) return null
  return Response.json({ error: 'access_code_required' }, { status: 401 })
}

export const serverPlacesKey = () => process.env.GOOGLE_PLACES_API_KEY || ''

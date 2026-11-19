import { NextRequest } from 'next/server'
import { accessDenied, serverPlacesKey } from '@/lib/access'

// Tells the UI whether it needs to ask for an API key / access code.
// Must be dynamic: it reads env vars, and a static build would freeze the answer at deploy time.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const needsCode = !!process.env.ACCESS_CODE
  const denied = accessDenied(req)
  return Response.json({ needsAccessCode: needsCode, authorized: !denied, serverKey: !denied && !!serverPlacesKey() })
}

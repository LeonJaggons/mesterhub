import { NextRequest } from 'next/server'
import { phoneVerificationEnabled } from '@/lib/featureFlags'
import { enforceIpRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const limited = await enforceIpRateLimit('publicRead', request)
  if (limited) return limited

  return Response.json({
    phoneNumberVerification: await phoneVerificationEnabled(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

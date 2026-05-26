import { phoneVerificationEnabled } from '@/lib/featureFlags'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    phoneNumberVerification: await phoneVerificationEnabled(),
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

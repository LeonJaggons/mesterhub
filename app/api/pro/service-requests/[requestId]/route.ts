import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { getProServiceRequest } from '@/lib/proServiceRequests'
import { FREE_CLEAR_INQUIRY_LIMIT } from '@/lib/inquiryAccess'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const { requestId } = await params
    const serviceRequest = await getProServiceRequest(user.uid, requestId)
    if (!serviceRequest) {
      return Response.json({ error: 'Request not found.' }, { status: 404 })
    }
    return Response.json({
      request: serviceRequest,
      access: {
        obfuscated: serviceRequest.obfuscated === true,
        freeClearInquiryLimit: FREE_CLEAR_INQUIRY_LIMIT,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/service-requests/[requestId]]', err)
    return Response.json({ error: 'Could not load pro service request.' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { listProServiceRequests } from '@/lib/proServiceRequests'
import { FREE_CLEAR_INQUIRY_LIMIT } from '@/lib/inquiryAccess'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const { requests, hasProPlan } = await listProServiceRequests(user.uid)
    return Response.json({
      requests,
      access: {
        hasProPlan,
        freeClearInquiryLimit: FREE_CLEAR_INQUIRY_LIMIT,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/service-requests]', err)
    return Response.json({ error: 'Could not load pro service requests.' }, { status: 500 })
  }
}

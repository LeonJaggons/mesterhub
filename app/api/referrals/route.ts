import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { enforceUserRateLimit } from '@/lib/rateLimit'
import { referralSummary, type ReferralOwnerRole } from '@/lib/referrals'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const role = request.nextUrl.searchParams.get('role') === 'pro' ? 'pro' : 'customer'
    if (role === 'pro') {
      const proSnap = await adminDb.collection('pros').doc(user.uid).get()
      if (!proSnap.exists) return Response.json({ error: 'Pro profile not found.' }, { status: 404 })
    }
    const summary = await referralSummary(user.uid, role as ReferralOwnerRole)
    return Response.json({ referral: summary })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/referrals GET]', err)
    return Response.json({ error: 'Could not load referral details.' }, { status: 500 })
  }
}

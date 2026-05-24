import { FieldValue } from 'firebase-admin/firestore'
import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { appUrl, periodEndMillis, stripeProPriceId } from '@/lib/billing'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const profileRef = adminDb.collection('pros').doc(user.uid)
    const accountRef = profileRef.collection('private').doc('account')
    const [profileSnap, accountSnap] = await Promise.all([profileRef.get(), accountRef.get()])

    if (!profileSnap.exists) {
      return Response.json({ error: 'Pro profile not found.' }, { status: 404 })
    }

    const profile = profileSnap.data() ?? {}
    const account = accountSnap.data() ?? {}
    let customerId = typeof account.stripeCustomerId === 'string' ? account.stripeCustomerId : ''

    if (!customerId) {
      const customer = await stripe().customers.create({
        email: user.email ?? (typeof account.email === 'string' ? account.email : undefined),
        name: typeof profile.fullName === 'string' ? profile.fullName : undefined,
        metadata: { firebaseUid: user.uid },
      })
      customerId = customer.id
      await accountRef.set({
        stripeCustomerId: customerId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    const subscriptionData: { metadata: { firebaseUid: string }; trial_end?: number } = {
      metadata: { firebaseUid: user.uid },
    }
    const subscriptionStatus = account.subscriptionStatus ?? profile.subscriptionStatus
    const trialEnd = periodEndMillis(account.subscriptionCurrentPeriodEnd ?? profile.subscriptionCurrentPeriodEnd)
    if (subscriptionStatus === 'trialing' && trialEnd && trialEnd > Date.now() + 2 * 24 * 60 * 60 * 1000) {
      subscriptionData.trial_end = Math.floor(trialEnd / 1000)
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: stripeProPriceId(), quantity: 1 }],
      allow_promotion_codes: true,
      success_url: appUrl('/pro/settings?billing=success'),
      cancel_url: appUrl('/pro/settings?billing=cancelled'),
      client_reference_id: user.uid,
      metadata: { firebaseUid: user.uid },
      subscription_data: subscriptionData,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/stripe/checkout POST]', err)
    return Response.json({ error: 'Could not start Stripe checkout.' }, { status: 500 })
  }
}

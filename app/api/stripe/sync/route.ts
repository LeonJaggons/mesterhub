import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { stripe } from '@/lib/stripe'
import { syncStripeSubscription } from '@/lib/stripeSubscription'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const accountSnap = await adminDb
      .collection('pros')
      .doc(user.uid)
      .collection('private')
      .doc('account')
      .get()
    const customerId = accountSnap.data()?.stripeCustomerId

    if (typeof customerId !== 'string' || !customerId) {
      return Response.json({ error: 'No Stripe customer exists for this pro account yet.' }, { status: 400 })
    }

    const subscriptions = await stripe().subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    })
    const subscription = subscriptions.data
      .filter(item => item.status !== 'canceled' && item.status !== 'incomplete_expired')
      .sort((a, b) => b.created - a.created)[0] ?? subscriptions.data[0]

    if (!subscription) {
      return Response.json({ subscriptionStatus: 'inactive' })
    }

    await syncStripeSubscription(subscription, user.uid)
    return Response.json({ subscriptionStatus: subscription.status })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/stripe/sync POST]', err)
    return Response.json({ error: 'Could not sync Stripe subscription.' }, { status: 500 })
  }
}

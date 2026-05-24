import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { appUrl, periodEndMillis, stripeProPriceId, type SubscriptionPeriodEnd } from '@/lib/billing'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

function isMissingStripeResource(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing'
}

function checkoutSubscriptionData(
  userUid: string,
  account: Record<string, unknown>,
  profile: Record<string, unknown>,
): { metadata: { firebaseUid: string }; trial_end?: number } {
  const subscriptionData: { metadata: { firebaseUid: string }; trial_end?: number } = {
    metadata: { firebaseUid: userUid },
  }
  const subscriptionStatus = account.subscriptionStatus ?? profile.subscriptionStatus
  const trialEnd = periodEndMillis(
    (account.subscriptionCurrentPeriodEnd ?? profile.subscriptionCurrentPeriodEnd) as SubscriptionPeriodEnd,
  )
  if (subscriptionStatus === 'trialing' && trialEnd && trialEnd > Date.now() + 2 * 24 * 60 * 60 * 1000) {
    subscriptionData.trial_end = Math.floor(trialEnd / 1000)
  }
  return subscriptionData
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const profileRef = adminDb.collection('pros').doc(user.uid)
    const accountRef = profileRef.collection('private').doc('account')
    const [profileSnap, accountSnap] = await Promise.all([profileRef.get(), accountRef.get()])
    const profile = profileSnap.data() ?? {}
    const account = accountSnap.data() ?? {}
    const customerId = accountSnap.data()?.stripeCustomerId

    if (typeof customerId !== 'string' || !customerId) {
      const customer = await stripe().customers.create({
        email: user.email ?? (typeof account.email === 'string' ? account.email : undefined),
        name: typeof profile.fullName === 'string' ? profile.fullName : undefined,
        metadata: { firebaseUid: user.uid },
      })
      await accountRef.set({
        stripeCustomerId: customer.id,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })

      const checkoutSession = await stripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: stripeProPriceId(), quantity: 1 }],
        allow_promotion_codes: true,
        success_url: appUrl('/pro/settings?billing=success'),
        cancel_url: appUrl('/pro/settings?billing=cancelled'),
        client_reference_id: user.uid,
        metadata: { firebaseUid: user.uid },
        subscription_data: checkoutSubscriptionData(user.uid, account, profile),
      })

      return Response.json({ url: checkoutSession.url })
    }

    let session: Stripe.BillingPortal.Session
    try {
      session = await stripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: appUrl('/pro/settings'),
      })
    } catch (err) {
      if (!isMissingStripeResource(err)) throw err

      const customer = await stripe().customers.create({
        email: user.email ?? (typeof account.email === 'string' ? account.email : undefined),
        name: typeof profile.fullName === 'string' ? profile.fullName : undefined,
        metadata: { firebaseUid: user.uid },
      })
      await Promise.all([
        accountRef.set({
          stripeCustomerId: customer.id,
          stripeSubscriptionId: FieldValue.delete(),
          stripePriceId: FieldValue.delete(),
          subscriptionStatus: 'inactive',
          subscriptionCurrentPeriodEnd: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true }),
        profileRef.set({
          subscriptionStatus: 'inactive',
          subscriptionActive: false,
          subscriptionCurrentPeriodEnd: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true }),
      ])

      const checkoutSession = await stripe().checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        line_items: [{ price: stripeProPriceId(), quantity: 1 }],
        allow_promotion_codes: true,
        success_url: appUrl('/pro/settings?billing=success'),
        cancel_url: appUrl('/pro/settings?billing=cancelled'),
        client_reference_id: user.uid,
        metadata: { firebaseUid: user.uid },
        subscription_data: checkoutSubscriptionData(user.uid, account, profile),
      })

      return Response.json({ url: checkoutSession.url })
    }

    return Response.json({ url: session.url })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/stripe/portal POST]', err)
    return Response.json({ error: 'Could not open Stripe billing portal.' }, { status: 500 })
  }
}

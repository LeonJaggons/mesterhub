import Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { hasPaidProFeatures, type ProSubscriptionStatus } from '@/lib/billing'

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number | null
}

export function stripeCustomerId(subscription: Stripe.Subscription): string {
  return typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const value = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription
  if (!value) return ''
  return typeof value === 'string' ? value : value.id
}

export async function uidForStripeCustomer(customerId: string): Promise<string> {
  const snap = await adminDb
    .collectionGroup('private')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get()
  return snap.docs[0]?.ref.parent.parent?.id ?? ''
}

export async function syncStripeSubscription(subscription: Stripe.Subscription, fallbackUid = '') {
  const customerId = stripeCustomerId(subscription)
  const uid = subscription.metadata.firebaseUid || fallbackUid || await uidForStripeCustomer(customerId)
  if (!uid) {
    console.warn('[stripe subscription sync] Could not resolve Firebase uid for customer', customerId)
    return
  }

  const status = subscription.status as ProSubscriptionStatus
  const periodEndSeconds = (subscription as SubscriptionWithPeriod).current_period_end
  const currentPeriodEnd = periodEndSeconds ? new Date(periodEndSeconds * 1000) : null
  const priceId = subscription.items.data[0]?.price.id ?? ''
  const active = hasPaidProFeatures(status, currentPeriodEnd)

  await Promise.all([
    adminDb.collection('pros').doc(uid).collection('private').doc('account').set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: status,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
    adminDb.collection('pros').doc(uid).set({
      subscriptionStatus: status,
      subscriptionActive: active,
      subscriptionCurrentPeriodEnd: currentPeriodEnd,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
  ])
}

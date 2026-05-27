import Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { sendAdminNotification } from '@/firebase/adminNotifications'
import { stripe } from '@/lib/stripe'
import { invoiceSubscriptionId, syncStripeSubscription } from '@/lib/stripeSubscription'

export const runtime = 'nodejs'

const STRIPE_EVENT_LEASE_MS = 10 * 60 * 1000

async function acquireStripeEvent(event: Stripe.Event): Promise<boolean> {
  const eventRef = adminDb.collection('stripeWebhookEvents').doc(event.id)
  const now = Date.now()
  const leaseExpiresAt = now + STRIPE_EVENT_LEASE_MS

  return adminDb.runTransaction(async transaction => {
    const snap = await transaction.get(eventRef)
    const data = snap.data()

    if (snap.exists && data?.status === 'processed') return false
    if (snap.exists && data?.status === 'processing' && Number(data.leaseExpiresAt) > now) return false

    transaction.set(eventRef, {
      stripeEventId: event.id,
      type: event.type,
      status: 'processing',
      leaseExpiresAt,
      receivedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return true
  })
}

async function markStripeEventProcessed(event: Stripe.Event): Promise<void> {
  await adminDb.collection('stripeWebhookEvents').doc(event.id).set({
    status: 'processed',
    processedAt: FieldValue.serverTimestamp(),
    leaseExpiresAt: FieldValue.delete(),
  }, { merge: true })
}

async function releaseStripeEvent(event: Stripe.Event): Promise<void> {
  await adminDb.collection('stripeWebhookEvents').doc(event.id).delete()
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return Response.json({ error: 'STRIPE_WEBHOOK_SECRET is required.' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing Stripe signature.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const payload = await request.text()
    event = stripe().webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook payload.'
    return Response.json({ error: message }, { status: 400 })
  }

  const shouldProcess = await acquireStripeEvent(event)
  if (!shouldProcess) {
    return Response.json({ received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (typeof session.subscription === 'string') {
          const subscription = await stripe().subscriptions.retrieve(session.subscription)
          await syncStripeSubscription(subscription)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscription(event.data.object)
        break
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const subscription = await stripe().subscriptions.retrieve(subscriptionId)
          await syncStripeSubscription(subscription)
        }
        await sendAdminNotification({
          event: 'admin.stripe.invoice_payment_failed',
          subject: 'Stripe payment failed',
          previewText: 'A pro subscription invoice payment failed.',
          text: [
            'Stripe reported a failed invoice payment.',
            `Invoice: ${invoice.id}`,
            `Customer: ${typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? 'Unknown'}`,
            `Subscription: ${subscriptionId || 'Unknown'}`,
            `Amount due: ${invoice.amount_due ?? 0} ${invoice.currency?.toUpperCase() ?? ''}`,
            invoice.hosted_invoice_url ? `Invoice URL: ${invoice.hosted_invoice_url}` : '',
          ].filter(Boolean).join('\n\n'),
          actionPath: '/admin/pros',
          metadata: {
            stripeInvoiceId: invoice.id,
            stripeCustomerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
            stripeSubscriptionId: subscriptionId || null,
            amountDue: invoice.amount_due ?? null,
            currency: invoice.currency ?? null,
          },
        })
        break
      }
      default:
        break
    }
    await markStripeEventProcessed(event)
  } catch (err) {
    await releaseStripeEvent(event)
    console.error('[stripe webhook]', err)
    return Response.json({ error: 'Could not process Stripe webhook.' }, { status: 500 })
  }

  return Response.json({ received: true })
}

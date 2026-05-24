import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { invoiceSubscriptionId, syncStripeSubscription } from '@/lib/stripeSubscription'

export const runtime = 'nodejs'

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
        const subscriptionId = invoiceSubscriptionId(event.data.object)
        if (subscriptionId) {
          const subscription = await stripe().subscriptions.retrieve(subscriptionId)
          await syncStripeSubscription(subscription)
        }
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe webhook]', err)
    return Response.json({ error: 'Could not process Stripe webhook.' }, { status: 500 })
  }

  return Response.json({ received: true })
}

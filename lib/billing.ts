export type ProSubscriptionStatus =
  | 'inactive'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused'

export const PAID_PRO_STATUSES = new Set<ProSubscriptionStatus>(['active', 'trialing'])

export type SubscriptionPeriodEnd = Date | string | number | null | undefined | {
  toDate?: () => Date
  toMillis?: () => number
}

export function periodEndMillis(value: SubscriptionPeriodEnd): number | null {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  return null
}

export function hasPaidProFeatures(
  status?: string | null,
  currentPeriodEnd?: SubscriptionPeriodEnd,
): boolean {
  if (status === 'active') return true
  if (status !== 'trialing') return false

  const end = periodEndMillis(currentPeriodEnd)
  return end === null || end > Date.now()
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

export function stripeProPriceId(): string {
  const priceId = process.env.STRIPE_PRO_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID
  if (!priceId) {
    throw new Error('STRIPE_PRO_PRICE_ID is required.')
  }
  return priceId
}

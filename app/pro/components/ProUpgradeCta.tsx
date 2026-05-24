'use client'

import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from './ProUpgradeCta.module.css'

type Variant = 'card' | 'inline'
type Tone = 'trial' | 'inactive'

type SubscriptionPeriodEnd = Date | string | number | null | undefined | {
  _seconds?: number
  seconds?: number
  toDate?: () => Date
  toMillis?: () => number
}

type BillingState = {
  status: string
  periodEnd?: SubscriptionPeriodEnd
}

const TRIAL_TITLE = 'Your free month is active'
const INACTIVE_TITLE = 'Unlock Mestermind Pro'

function periodEndMillis(value: SubscriptionPeriodEnd): number | null {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value.seconds === 'number') return value.seconds * 1000
  return null
}

function trialDaysLeft(periodEnd: SubscriptionPeriodEnd): number | null {
  const end = periodEndMillis(periodEnd)
  if (!end) return null
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)))
}

function ctaCopy(state: BillingState): { tone: Tone; title: string; body: string; action: string } | null {
  if (state.status === 'active') return null

  if (state.status === 'trialing') {
    const days = trialDaysLeft(state.periodEnd)
    return {
      tone: 'trial',
      title: TRIAL_TITLE,
      body: days === null
        ? 'Keep priority placement, visible reviews, and direct inquiries ready after your trial.'
        : `${days} day${days === 1 ? '' : 's'} left. Add billing when you are ready to keep Pro benefits on.`,
      action: 'Set up billing',
    }
  }

  return {
    tone: 'inactive',
    title: INACTIVE_TITLE,
    body: 'Get priority placement, visible reviews, verified badge, and direct customer inquiries.',
    action: 'Start Pro',
  }
}

export default function ProUpgradeCta({
  variant = 'card',
  className = '',
}: {
  variant?: Variant
  className?: string
}) {
  const [state, setState] = useState<BillingState | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)

  useEffect(() => {
    let active = true
    authenticatedFetch('/api/pro/profile')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const account = data.account ?? {}
        const profile = data.profile ?? {}
        setState({
          status: account.subscriptionStatus ?? profile.subscriptionStatus ?? 'inactive',
          periodEnd: account.subscriptionCurrentPeriodEnd ?? profile.subscriptionCurrentPeriodEnd,
        })
      })
      .catch(() => {
        if (active) setState(null)
      })
    return () => {
      active = false
    }
  }, [])

  if (!state) return null

  const copy = ctaCopy(state)
  if (!copy) return null

  const isInline = variant === 'inline'
  const shell = isInline
    ? 'rounded-xl border border-orange-100 bg-orange-50/70 px-4 py-3'
    : 'rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm'

  async function openCheckout() {
    setBillingLoading(true)
    try {
      const res = await authenticatedFetch('/api/stripe/checkout', { method: 'POST' })
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('Stripe did not return a checkout URL.')
      window.location.href = data.url
    } catch {
      setBillingLoading(false)
    }
  }

  return (
    <div className={`${shell} ${className}`}>
      <div className={isInline ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' : ''}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">
            {copy.tone === 'trial' ? 'Mestermind Pro trial' : 'Mestermind Pro'}
          </p>
          <h2 className={isInline ? 'text-base font-black text-gray-900' : 'text-2xl font-black leading-none text-gray-900'}>
            {copy.title}
          </h2>
          <p className={isInline ? 'mt-1 text-sm text-gray-600' : 'mt-2 text-sm leading-relaxed text-gray-600'}>
            {copy.body}
          </p>
        </div>
        <button
          type="button"
          disabled={billingLoading}
          onClick={openCheckout}
          className={isInline
            ? `${styles.shimmerButton} inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white`
            : `${styles.shimmerButton} mt-4 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white`}
        >
          {billingLoading ? 'Opening Stripe...' : copy.action}
        </button>
      </div>
    </div>
  )
}

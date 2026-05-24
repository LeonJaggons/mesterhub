'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from '../../account/account.module.css'

type ProProfile = {
  uid?: string
  fullName?: string
  categoryName?: string
  status?: string
  profileVisibility?: 'visible' | 'paused'
  bio?: string
  services?: string[]
  districts?: number[]
  availability?: string[]
  paymentMethods?: string[]
  avatarUrl?: string | null
  workPhotoUrls?: string[]
  pastProjects?: unknown[]
  phoneVerified?: boolean
  backgroundCheck?: boolean
  certificateUrl?: string | null
  insuranceUrl?: string | null
  subscriptionStatus?: string
  subscriptionActive?: boolean
  subscriptionCurrentPeriodEnd?: SubscriptionPeriodEnd
}

type AccountData = {
  phone?: string
  notificationPreferences?: NotificationPreferences
  subscriptionStatus?: string
  subscriptionCurrentPeriodEnd?: SubscriptionPeriodEnd
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

type SubscriptionPeriodEnd = Date | string | number | null | undefined | {
  toDate?: () => Date
  toMillis?: () => number
}

type VerificationData = {
  idDocumentUrl?: string | null
  selfieUrl?: string | null
  certificateUrl?: string | null
  insuranceUrl?: string | null
  backgroundCheck?: boolean
  regulated?: boolean
  status?: string
}

type NotificationPreferences = {
  newLeads: boolean
  messages: boolean
  appointments: boolean
  email: boolean
  sms: boolean
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  newLeads: true,
  messages: true,
  appointments: true,
  email: true,
  sms: false,
}

function initials(name?: string) {
  return name ? name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() : 'MP'
}

function statusCopy(status?: string) {
  if (status === 'active') return 'Approved'
  if (status === 'suspended') return 'Suspended'
  if (status === 'rejected') return 'Rejected'
  return 'Pending verification'
}

function completionScore(profile: ProProfile, account: AccountData, verification: VerificationData) {
  const checks = [
    Boolean(profile.fullName),
    Boolean(account.phone),
    Boolean(profile.bio),
    Boolean(profile.services?.length),
    Boolean(profile.districts?.length),
    Boolean(profile.availability?.length),
    Boolean(profile.paymentMethods?.length),
    Boolean(profile.avatarUrl),
    Boolean(profile.pastProjects?.length || profile.workPhotoUrls?.length),
    Boolean(verification.idDocumentUrl && verification.selfieUrl),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

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
  return null
}

function hasProFeatures(status: string, currentPeriodEnd: SubscriptionPeriodEnd): boolean {
  if (status === 'active') return true
  if (status !== 'trialing') return false
  const end = periodEndMillis(currentPeriodEnd)
  return end === null || end > Date.now()
}

const buttonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  padding: '0 1rem',
  borderRadius: 10,
  fontWeight: 800,
  fontSize: '0.9375rem',
  textDecoration: 'none',
  cursor: 'pointer',
} as const

const primaryButton = {
  ...buttonBase,
  border: '1px solid #f97316',
  background: '#f97316',
  color: '#fff',
} as const

const secondaryButton = {
  ...buttonBase,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#374151',
} as const

const darkButton = {
  ...buttonBase,
  border: '1px solid #111827',
  background: '#111827',
  color: '#fff',
} as const

export default function ProSettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProProfile>({})
  const [account, setAccount] = useState<AccountData>({})
  const [verification, setVerification] = useState<VerificationData>({})
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  async function saveSettings(patch: {
    profileVisibility?: 'visible' | 'paused'
    notificationPreferences?: NotificationPreferences
  }, successMessage: string) {
    setSaving(true)
    setSaved('')
    setError('')
    try {
      await authenticatedFetch('/api/pro/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      if (patch.profileVisibility) {
        setProfile(prev => ({ ...prev, profileVisibility: patch.profileVisibility }))
      }
      if (patch.notificationPreferences) {
        setNotifications(patch.notificationPreferences)
        setAccount(prev => ({ ...prev, notificationPreferences: patch.notificationPreferences }))
      }
      setSaved(successMessage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  function toggleNotification(key: keyof NotificationPreferences) {
    const next = { ...notifications, [key]: !notifications[key] }
    saveSettings({ notificationPreferences: next }, 'Notification preferences saved.')
  }

  async function openBilling(path: '/api/stripe/checkout' | '/api/stripe/portal') {
    setBillingLoading(true)
    setSaved('')
    setError('')
    try {
      const res = await authenticatedFetch(path, { method: 'POST' })
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('Stripe did not return a billing URL.')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Stripe billing.')
      setBillingLoading(false)
    }
  }

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/pro/settings')
        return
      }
      try {
        if (new URLSearchParams(window.location.search).get('billing') === 'success') {
          await authenticatedFetch('/api/stripe/sync', { method: 'POST' })
        }
        const res = await authenticatedFetch('/api/pro/profile')
        const data = await res.json()
        setProfile(data.profile ?? {})
        setAccount(data.account ?? {})
        setVerification(data.verification ?? {})
        setNotifications({
          ...DEFAULT_NOTIFICATIONS,
          ...(data.account?.notificationPreferences ?? {}),
        })
      } catch {
        setError('Could not load your pro profile.')
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}><p className={styles.subtitle}>Loading settings...</p></div>
      </main>
    )
  }

  const score = completionScore(profile, account, verification)
  const visibility = profile.profileVisibility ?? 'visible'
  const isVisibleInSearch = profile.status === 'active' && visibility !== 'paused'
  const subscriptionStatus = account.subscriptionStatus ?? profile.subscriptionStatus ?? 'inactive'
  const subscriptionCurrentPeriodEnd = account.subscriptionCurrentPeriodEnd ?? profile.subscriptionCurrentPeriodEnd
  const hasProPlan = hasProFeatures(subscriptionStatus, subscriptionCurrentPeriodEnd)
  const canManageBilling = Boolean(account.stripeCustomerId) && ['active', 'trialing', 'past_due', 'unpaid'].includes(subscriptionStatus)
  const verificationItems = [
    ['Identity document', Boolean(verification.idDocumentUrl)],
    ['Selfie match', Boolean(verification.selfieUrl)],
    ['Phone verification', Boolean(profile.phoneVerified || account.phone)],
    ['Certificate', !verification.regulated || Boolean(verification.certificateUrl)],
    ['Insurance', Boolean(verification.insuranceUrl)],
    ['Background check', Boolean(verification.backgroundCheck)],
  ] as const

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Pro settings</h1>
        <p className={styles.subtitle}>Manage the profile customers see after you are approved.</p>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          {error && <p className={styles.errorText}>{error}</p>}
          {saved && <p className={styles.successText}>{saved}</p>}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 12, background: '#f97316', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem' }}>
                {initials(profile.fullName)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <p className={styles.emptyTitle} style={{ marginBottom: 0 }}>{profile.fullName || 'Your pro profile'}</p>
                <span style={{ borderRadius: 999, padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 800, background: isVisibleInSearch ? '#dcfce7' : '#f3f4f6', color: isVisibleInSearch ? '#166534' : '#6b7280' }}>
                  {isVisibleInSearch ? 'Visible in search' : visibility === 'paused' ? 'Paused' : statusCopy(profile.status)}
                </span>
              </div>
              <p className={styles.subtitle} style={{ margin: '0.25rem 0 0.75rem' }}>
                {profile.categoryName || 'Profile details'} · {statusCopy(profile.status)}
              </p>
              <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: `${score}%`, height: '100%', background: '#f97316' }} />
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>{score}% profile complete</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              ['Services', profile.services?.length ?? 0],
              ['Districts', profile.districts?.length ?? 0],
              ['Projects', profile.pastProjects?.length ?? profile.workPhotoUrls?.length ?? 0],
              ['Payments', profile.paymentMethods?.length ?? 0],
            ].map(([label, value]) => (
              <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#111827' }}>{value}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{label}</p>
              </div>
            ))}
          </div>
          <Link href="/pro/settings/profile" style={primaryButton}>
            Edit profile
          </Link>
          {profile.uid && (
            <Link href={`/pro/${profile.uid}`} style={{ ...secondaryButton, marginLeft: '0.75rem' }}>
              View public profile
            </Link>
          )}
        </div>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2>Mestermind Pro</h2>
                <p style={{ margin: '0.35rem 0 0' }}>
                  {hasProPlan
                    ? 'Your paid pro features are active.'
                    : 'Subscribe to unlock customer-facing growth features.'}
                </p>
              </div>
              <span style={{ borderRadius: 999, padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 900, background: hasProPlan ? '#dcfce7' : '#f3f4f6', color: hasProPlan ? '#166534' : '#6b7280', textTransform: 'capitalize' }}>
                {subscriptionStatus.replaceAll('_', ' ')}
              </span>
            </div>
            <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
              {[
                'Unlimited job inquiries',
                'Priority placement in search',
                'Verified badge',
                'Reviews visible on profile',
                'Featured in category pages',
                'Direct messages from customers',
              ].map(feature => (
                <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#374151', fontWeight: 700 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hasProPlan ? '#dcfce7' : '#f3f4f6', color: hasProPlan ? '#15803d' : '#9ca3af', fontSize: '0.75rem' }}>
                    ✓
                  </span>
                  {feature}
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={billingLoading}
              onClick={() => openBilling(canManageBilling ? '/api/stripe/portal' : '/api/stripe/checkout')}
              style={canManageBilling ? secondaryButton : primaryButton}
            >
              {billingLoading ? 'Opening Stripe...' : canManageBilling ? 'Manage billing' : 'Subscribe with Stripe'}
            </button>
          </section>
        </div>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <h2>Profile visibility</h2>
            <p style={{ marginBottom: '1rem' }}>
              {isVisibleInSearch
                ? 'Your approved profile can appear in customer search and receive estimate requests.'
                : visibility === 'paused'
                  ? 'Your profile is paused and hidden from search. Existing conversations are unchanged.'
                  : 'Your profile will appear in search after approval.'}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveSettings({ profileVisibility: visibility === 'paused' ? 'visible' : 'paused' }, visibility === 'paused' ? 'Profile visibility resumed.' : 'Profile paused.')}
              style={visibility === 'paused' ? primaryButton : darkButton}
            >
              {visibility === 'paused' ? 'Resume profile' : 'Pause profile'}
            </button>
          </section>
        </div>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <h2>Notification preferences</h2>
            <p style={{ marginBottom: '1rem' }}>Choose what should trigger pro alerts during the MVP launch.</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                ['newLeads', 'New estimate requests'],
                ['messages', 'Customer messages'],
                ['appointments', 'Appointment updates'],
                ['email', 'Email notifications'],
                ['sms', 'SMS notifications'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{label}</span>
                  <input
                    type="checkbox"
                    checked={notifications[key as keyof NotificationPreferences]}
                    disabled={saving}
                    onChange={() => toggleNotification(key as keyof NotificationPreferences)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.card}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <h2>Verification center</h2>
            <p style={{ marginBottom: '1rem' }}>Track what has been submitted for approval and what customers can trust.</p>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              {verificationItems.map(([label, complete]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{label}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: complete ? '#15803d' : '#9ca3af' }}>
                    {complete ? 'Complete' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/pro/verification"
              style={secondaryButton}
            >
              View verification details
            </Link>
          </section>
        </div>
      </div>
    </main>
  )
}

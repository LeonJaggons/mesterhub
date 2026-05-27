'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from '../../account/account.module.css'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

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

type ReferralSummary = {
  code: string
  inviteUrl: string
  rewardAmountFt: number
  referralCount: number
  approvedCount: number
  pendingRewardCount: number
  rewardedCount: number
  pendingRewardFt: number
  paidRewardFt: number
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

type Translator = ReturnType<typeof useTranslations>

function statusCopy(t: Translator, status?: string) {
  if (status === 'active') return t('proSettings.status.approved')
  if (status === 'suspended') return t('proSettings.status.suspended')
  if (status === 'rejected') return t('proSettings.status.rejected')
  return t('proSettings.status.pending')
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
  const t = useTranslations()
  const [profile, setProfile] = useState<ProProfile>({})
  const [account, setAccount] = useState<AccountData>({})
  const [verification, setVerification] = useState<VerificationData>({})
  const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [referralCopied, setReferralCopied] = useState(false)

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
      setError(err instanceof Error ? err.message : t('proSettings.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  function toggleNotification(key: keyof NotificationPreferences) {
    const next = { ...notifications, [key]: !notifications[key] }
    saveSettings({ notificationPreferences: next }, t('proSettings.notifications.saved'))
  }

  async function openBilling(path: '/api/stripe/checkout' | '/api/stripe/portal') {
    setBillingLoading(true)
    setSaved('')
    setError('')
    try {
      const res = await authenticatedFetch(path, { method: 'POST' })
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error(t('proSettings.errors.stripeUrl'))
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proSettings.errors.stripeOpen'))
      setBillingLoading(false)
    }
  }

  async function copyReferralLink() {
    if (!referral?.inviteUrl) return
    await navigator.clipboard.writeText(referral.inviteUrl)
    setReferralCopied(true)
    window.setTimeout(() => setReferralCopied(false), 2000)
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
        const referralRes = await authenticatedFetch('/api/referrals?role=pro')
        const referralData = (await referralRes.json()) as { referral?: ReferralSummary }
        setProfile(data.profile ?? {})
        setAccount(data.account ?? {})
        setVerification(data.verification ?? {})
        setReferral(referralData.referral ?? null)
        setNotifications({
          ...DEFAULT_NOTIFICATIONS,
          ...(data.account?.notificationPreferences ?? {}),
        })
      } catch {
        setError(t('proSettings.errors.load'))
      } finally {
        setLoading(false)
      }
    })
  }, [router, t])

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}><p className={styles.subtitle}>{t('proSettings.loading')}</p></div>
      </main>
    )
  }

  const score = completionScore(profile, account, verification)
  const visibility = profile.profileVisibility ?? 'visible'
  const isVisibleInSearch = profile.status === 'active' && visibility !== 'paused'
  const subscriptionStatus = account.subscriptionStatus ?? profile.subscriptionStatus ?? 'inactive'
  const subscriptionCurrentPeriodEnd = account.subscriptionCurrentPeriodEnd ?? profile.subscriptionCurrentPeriodEnd
  const hasProPlan = hasProFeatures(subscriptionStatus, subscriptionCurrentPeriodEnd)
  const canManageBilling = Boolean(account.stripeCustomerId) && ['active', 'past_due', 'unpaid'].includes(subscriptionStatus)
  const verificationItems = [
    [t('proSettings.verification.items.identity'), Boolean(verification.idDocumentUrl)],
    [t('proSettings.verification.items.selfie'), Boolean(verification.selfieUrl)],
    [t('proSettings.verification.items.phone'), Boolean(profile.phoneVerified || account.phone)],
    [t('proSettings.verification.items.certificate'), !verification.regulated || Boolean(verification.certificateUrl)],
    [t('proSettings.verification.items.insurance'), Boolean(verification.insuranceUrl)],
    [t('proSettings.verification.items.background'), Boolean(verification.backgroundCheck)],
  ] as const

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('proSettings.header.title')}</h1>
        <p className={styles.subtitle}>{t('proSettings.header.subtitle')}</p>

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
                <p className={styles.emptyTitle} style={{ marginBottom: 0 }}>{profile.fullName || t('proSettings.profile.fallbackName')}</p>
                <span style={{ borderRadius: 999, padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 800, background: isVisibleInSearch ? '#dcfce7' : '#f3f4f6', color: isVisibleInSearch ? '#166534' : '#6b7280' }}>
                  {isVisibleInSearch ? t('proSettings.profile.visible') : visibility === 'paused' ? t('proSettings.profile.paused') : statusCopy(t, profile.status)}
                </span>
              </div>
              <p className={styles.subtitle} style={{ margin: '0.25rem 0 0.75rem' }}>
                {profile.categoryName ? translateCategory(t, profile.categoryName) : t('proSettings.profile.details')} · {statusCopy(t, profile.status)}
              </p>
              <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginBottom: '0.5rem' }}>
                <div style={{ width: `${score}%`, height: '100%', background: '#f97316' }} />
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>{t('proSettings.profile.complete', { score })}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              [t('proSettings.profile.stats.services'), profile.services?.length ?? 0],
              [t('proSettings.profile.stats.districts'), profile.districts?.length ?? 0],
              [t('proSettings.profile.stats.projects'), profile.pastProjects?.length ?? profile.workPhotoUrls?.length ?? 0],
              [t('proSettings.profile.stats.payments'), profile.paymentMethods?.length ?? 0],
            ].map(([label, value]) => (
              <div key={label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem' }}>
                <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#111827' }}>{value}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>{label}</p>
              </div>
            ))}
          </div>
          <Link href="/pro/settings/profile" style={primaryButton}>
            {t('proSettings.profile.edit')}
          </Link>
          {profile.uid && (
            <Link href={`/pro/${profile.uid}`} style={{ ...secondaryButton, marginLeft: '0.75rem' }}>
              {t('proSettings.profile.viewPublic')}
            </Link>
          )}
        </div>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <h2>{t('proSettings.referrals.title')}</h2>
            <p style={{ marginBottom: '1rem' }}>{t('proSettings.referrals.body', { amount: referral?.rewardAmountFt ?? 3000 })}</p>
            <div className={styles.referralStats}>
              <div>
                <span className={styles.statLabel}>{t('proSettings.referrals.pendingCash')}</span>
                <strong className={styles.statValue}>{referral?.pendingRewardFt ?? 0} Ft</strong>
              </div>
              <div>
                <span className={styles.statLabel}>{t('proSettings.referrals.invited')}</span>
                <strong className={styles.statValue}>{referral?.referralCount ?? 0}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>{t('proSettings.referrals.approved')}</span>
                <strong className={styles.statValue}>{referral?.approvedCount ?? 0}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>{t('proSettings.referrals.rewarded')}</span>
                <strong className={styles.statValue}>{referral?.rewardedCount ?? 0}</strong>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="proReferralCode">{t('proSettings.referrals.code')}</label>
              <input id="proReferralCode" className={styles.input} value={referral?.code ?? ''} readOnly />
            </div>
            <div className={styles.copyRow}>
              <input
                className={styles.input}
                value={referral?.inviteUrl ?? ''}
                readOnly
                aria-label={t('proSettings.referrals.link')}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={copyReferralLink}
                disabled={!referral?.inviteUrl}
              >
                {referralCopied ? t('proSettings.referrals.copied') : t('proSettings.referrals.copy')}
              </button>
            </div>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{t('proSettings.referrals.unlock')}</p>
          </section>
        </div>

        <div
          className={styles.card}
          style={{
            marginBottom: '1rem',
            padding: 0,
            overflow: 'hidden',
            borderColor: hasProPlan ? '#bbf7d0' : '#fed7aa',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 42%, #f8fafc 100%)',
          }}
        >
          <section className={styles.helpSection} style={{ marginBottom: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', minWidth: 0 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    background: 'linear-gradient(135deg, #f97316, #ea580c)',
                    boxShadow: '0 10px 24px rgba(249, 115, 22, 0.18)',
                    flexShrink: 0,
                  }}
                >
                  ✦
                </span>
                <div>
                  <p style={{ margin: '0 0 0.25rem', color: '#f97316', fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {t('proSettings.billing.kicker')}
                  </p>
                  <h2 style={{ margin: 0 }}>{t('proSettings.billing.title')}</h2>
                  <p style={{ margin: '0.4rem 0 0', color: '#4b5563', maxWidth: 520 }}>
                    {hasProPlan
                      ? t('proSettings.billing.activeBody')
                      : t('proSettings.billing.inactiveBody')}
                  </p>
                </div>
              </div>
              <span style={{ borderRadius: 999, padding: '0.32rem 0.75rem', fontSize: '0.75rem', fontWeight: 900, background: hasProPlan ? '#dcfce7' : '#fff7ed', border: `1px solid ${hasProPlan ? '#bbf7d0' : '#fed7aa'}`, color: hasProPlan ? '#166534' : '#c2410c', textTransform: 'capitalize' }}>
                {t(`proSettings.billing.status.${subscriptionStatus.replaceAll('-', '_')}`, { defaultValue: subscriptionStatus.replaceAll('_', ' ') })}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.55rem', marginBottom: '1.1rem' }}>
              {[
                t('proSettings.billing.features.inquiries'),
                t('proSettings.billing.features.priority'),
                t('proSettings.billing.features.badge'),
                t('proSettings.billing.features.reviews'),
                t('proSettings.billing.features.featured'),
                t('proSettings.billing.features.messages'),
              ].map(feature => (
                <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: '#374151', fontWeight: 750, background: 'rgba(255, 255, 255, 0.72)', border: '1px solid rgba(229, 231, 235, 0.85)', borderRadius: 12, padding: '0.55rem 0.65rem' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hasProPlan ? '#dcfce7' : '#ffedd5', color: hasProPlan ? '#15803d' : '#ea580c', fontSize: '0.75rem', fontWeight: 900, flexShrink: 0 }}>
                    ✓
                  </span>
                  {feature}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid rgba(229, 231, 235, 0.8)' }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                {hasProPlan ? t('proSettings.billing.manageCopy') : t('proSettings.billing.subscribeCopy')}
              </p>
              <button
                type="button"
                disabled={billingLoading}
                onClick={() => openBilling(canManageBilling ? '/api/stripe/portal' : '/api/stripe/checkout')}
                style={{
                  ...(canManageBilling ? secondaryButton : primaryButton),
                  boxShadow: canManageBilling ? 'none' : '0 10px 22px rgba(249, 115, 22, 0.18)',
                }}
              >
                {billingLoading ? t('proSettings.billing.opening') : canManageBilling ? t('proSettings.billing.manage') : t('proSettings.billing.subscribe')}
              </button>
            </div>
          </section>
        </div>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <h2>{t('proSettings.visibility.title')}</h2>
            <p style={{ marginBottom: '1rem' }}>
              {isVisibleInSearch
                ? t('proSettings.visibility.visibleBody')
                : visibility === 'paused'
                  ? t('proSettings.visibility.pausedBody')
                  : t('proSettings.visibility.pendingBody')}
            </p>
            <button
              type="button"
              disabled={saving}
              onClick={() => saveSettings(
                { profileVisibility: visibility === 'paused' ? 'visible' : 'paused' },
                visibility === 'paused' ? t('proSettings.visibility.resumed') : t('proSettings.visibility.pausedSaved')
              )}
              style={visibility === 'paused' ? primaryButton : darkButton}
            >
              {visibility === 'paused' ? t('proSettings.visibility.resume') : t('proSettings.visibility.pause')}
            </button>
          </section>
        </div>

        <div className={styles.card} style={{ marginBottom: '1rem' }}>
          <section className={styles.helpSection} style={{ marginBottom: 0 }}>
            <h2>{t('proSettings.notifications.title')}</h2>
            <p style={{ marginBottom: '1rem' }}>{t('proSettings.notifications.subtitle')}</p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                ['newLeads', t('proSettings.notifications.items.newLeads')],
                ['messages', t('proSettings.notifications.items.messages')],
                ['appointments', t('proSettings.notifications.items.appointments')],
                ['email', t('proSettings.notifications.items.email')],
                ['sms', t('proSettings.notifications.items.sms')],
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
            <h2>{t('proSettings.verification.title')}</h2>
            <p style={{ marginBottom: '1rem' }}>{t('proSettings.verification.subtitle')}</p>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
              {verificationItems.map(([label, complete]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#111827' }}>{label}</span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: complete ? '#15803d' : '#9ca3af' }}>
                    {complete ? t('proSettings.verification.complete') : t('proSettings.verification.missing')}
                  </span>
                </div>
              ))}
            </div>
            <Link
              href="/pro/verification"
              style={secondaryButton}
            >
              {t('proSettings.verification.viewDetails')}
            </Link>
          </section>
        </div>
      </div>
    </main>
  )
}

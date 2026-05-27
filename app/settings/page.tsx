'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, updateDisplayName } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { useTranslations } from '@/lib/i18n/client'
import type { User } from 'firebase/auth'
import districtsData from '@/public/districts.json'
import AddressAutocompleteInput from '../components/AddressAutocompleteInput'
import styles from '../account/account.module.css'

type CustomerProfile = {
  uid: string
  email: string
  emailVerified: boolean
  displayName: string
  firstName?: string
  lastName?: string
  phone?: string
  preferredDistrict?: string
  address?: string
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

type ProfileForm = {
  firstName: string
  lastName: string
  displayName: string
  phone: string
  preferredDistrict: string
  address: string
}

const emptyForm: ProfileForm = {
  firstName: '',
  lastName: '',
  displayName: '',
  phone: '',
  preferredDistrict: '',
  address: '',
}

function splitDisplayName(displayName: string): Pick<ProfileForm, 'firstName' | 'lastName'> {
  const [firstName = '', ...rest] = displayName.trim().split(/\s+/).filter(Boolean)
  return { firstName, lastName: rest.join(' ') }
}

export default function SettingsPage() {
  const router = useRouter()
  const t = useTranslations()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [referralCopied, setReferralCopied] = useState(false)

  useEffect(() => {
    return onAuthChange(async u => {
      if (!u) {
        router.replace('/login?next=/settings')
        return
      }
      setUser(u)
      const authName = u.displayName ?? ''
      const authParts = splitDisplayName(authName)
      setForm({
        ...emptyForm,
        ...authParts,
        displayName: authName,
      })
      try {
        const res = await authenticatedFetch('/api/profile')
        const data = (await res.json()) as { profile?: CustomerProfile }
        const referralRes = await authenticatedFetch('/api/referrals')
        const referralData = (await referralRes.json()) as { referral?: ReferralSummary }
        const nextProfile = data.profile
        const displayName = nextProfile?.displayName ?? authName
        const nameParts = splitDisplayName(displayName)
        setProfile(nextProfile ?? null)
        setReferral(referralData.referral ?? null)
        setForm({
          firstName: nextProfile?.firstName ?? nameParts.firstName,
          lastName: nextProfile?.lastName ?? nameParts.lastName,
          displayName,
          phone: nextProfile?.phone ?? '',
          preferredDistrict: nextProfile?.preferredDistrict ?? '',
          address: nextProfile?.address ?? '',
        })
      } catch {
        // Firebase Auth remains the source of truth if the profile document is not available yet.
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  async function copyReferralLink() {
    if (!referral?.inviteUrl) return
    await navigator.clipboard.writeText(referral.inviteUrl)
    setReferralCopied(true)
    window.setTimeout(() => setReferralCopied(false), 2000)
  }

  function updateField(field: keyof ProfileForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const displayName = form.displayName.trim()
      if (!displayName) {
        throw new Error(t('settings.errors.displayNameRequired'))
      }
      await updateDisplayName(displayName)
      await authenticatedFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          displayName,
          phone: form.phone,
          preferredDistrict: form.preferredDistrict,
          address: form.address,
        }),
      })
      setSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <p className={styles.subtitle}>{t('settings.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>

        <form className={styles.cardStack} onSubmit={handleSubmit}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('settings.profile.title')}</h2>
            <p className={styles.helperText}>{t('settings.profile.body')}</p>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="firstName">{t('settings.profile.firstName')}</label>
                <input
                  id="firstName"
                  className={styles.input}
                  value={form.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  placeholder={t('settings.profile.firstName')}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="lastName">{t('settings.profile.lastName')}</label>
                <input
                  id="lastName"
                  className={styles.input}
                  value={form.lastName}
                  onChange={e => updateField('lastName', e.target.value)}
                  placeholder={t('settings.profile.lastName')}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="displayName">{t('settings.profile.displayName')}</label>
              <input
                id="displayName"
                className={styles.input}
                value={form.displayName}
                onChange={e => updateField('displayName', e.target.value)}
                placeholder={t('settings.profile.displayNamePlaceholder')}
                required
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('settings.contact.title')}</h2>
            <p className={styles.helperText}>{t('settings.contact.body')}</p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">{t('settings.contact.phone')}</label>
              <input
                id="phone"
                className={styles.input}
                type="tel"
                value={form.phone}
                onChange={e => updateField('phone', e.target.value)}
                placeholder="+36..."
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="preferredDistrict">{t('settings.contact.preferredDistrict')}</label>
              <select
                id="preferredDistrict"
                className={styles.input}
                value={form.preferredDistrict}
                onChange={e => updateField('preferredDistrict', e.target.value)}
              >
                <option value="">{t('settings.contact.noDistrict')}</option>
                {districtsData.districts.map(district => (
                  <option key={district.roman} value={district.roman}>
                    {t('settings.contact.district', { district: district.roman, name: district.name })}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="address">{t('settings.contact.address')}</label>
              <AddressAutocompleteInput
                id="address"
                className={styles.input}
                value={form.address}
                onChange={value => updateField('address', value)}
                placeholder={t('settings.contact.addressPlaceholder')}
              />
              <p className={styles.helperText}>{t('settings.contact.addressHelper')}</p>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('settings.referrals.title')}</h2>
            <p className={styles.helperText}>{t('settings.referrals.body', { amount: referral?.rewardAmountFt ?? 3000 })}</p>

            <div className={styles.referralStats}>
              <div>
                <span className={styles.statLabel}>{t('settings.referrals.pendingCash')}</span>
                <strong className={styles.statValue}>{referral?.pendingRewardFt ?? 0} Ft</strong>
              </div>
              <div>
                <span className={styles.statLabel}>{t('settings.referrals.invited')}</span>
                <strong className={styles.statValue}>{referral?.referralCount ?? 0}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>{t('settings.referrals.approved')}</span>
                <strong className={styles.statValue}>{referral?.approvedCount ?? 0}</strong>
              </div>
              <div>
                <span className={styles.statLabel}>{t('settings.referrals.rewarded')}</span>
                <strong className={styles.statValue}>{referral?.rewardedCount ?? 0}</strong>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="referralCode">{t('settings.referrals.code')}</label>
              <input id="referralCode" className={styles.input} value={referral?.code ?? ''} readOnly />
            </div>

            <div className={styles.copyRow}>
              <input
                className={styles.input}
                value={referral?.inviteUrl ?? ''}
                readOnly
                aria-label={t('settings.referrals.link')}
              />
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={copyReferralLink}
                disabled={!referral?.inviteUrl}
              >
                {referralCopied ? t('settings.referrals.copied') : t('settings.referrals.copy')}
              </button>
            </div>
            <p className={styles.helperText}>{t('settings.referrals.unlock')}</p>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('settings.signin.title')}</h2>
            <p className={styles.helperText}>{t('settings.signin.body')}</p>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">{t('settings.signin.email')}</label>
                <input id="email" className={styles.input} value={profile?.email ?? user?.email ?? ''} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="emailVerified">{t('settings.signin.emailStatus')}</label>
                <input
                  id="emailVerified"
                  className={styles.input}
                  value={(profile?.emailVerified ?? user?.emailVerified) ? t('settings.signin.verified') : t('settings.signin.notVerified')}
                  disabled
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="uid">{t('settings.signin.accountId')}</label>
              <input id="uid" className={styles.input} value={profile?.uid ?? user?.uid ?? ''} disabled />
            </div>
          </section>

          <section className={`${styles.card} ${styles.actionCard}`}>
            {error && <p className={styles.errorText}>{error}</p>}
            {saved && <p className={styles.successText}>{t('settings.saved')}</p>}

            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? t('settings.saving') : t('settings.submit')}
            </button>
          </section>
        </form>
      </div>
    </div>
  )
}

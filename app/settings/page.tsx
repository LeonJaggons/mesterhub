'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange, updateDisplayName } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import type { User } from 'firebase/auth'
import districtsData from '@/public/districts.json'
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
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

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
        const nextProfile = data.profile
        const displayName = nextProfile?.displayName ?? authName
        const nameParts = splitDisplayName(displayName)
        setProfile(nextProfile ?? null)
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
        throw new Error('Display name is required.')
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
      setError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <p className={styles.subtitle}>Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Account settings</h1>
        <p className={styles.subtitle}>Manage your profile and sign-in details.</p>

        <form className={styles.cardStack} onSubmit={handleSubmit}>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Profile details</h2>
            <p className={styles.helperText}>These details are shown on requests, messages, and appointment details.</p>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="firstName">First name</label>
                <input
                  id="firstName"
                  className={styles.input}
                  value={form.firstName}
                  onChange={e => updateField('firstName', e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="lastName">Last name</label>
                <input
                  id="lastName"
                  className={styles.input}
                  value={form.lastName}
                  onChange={e => updateField('lastName', e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                className={styles.input}
                value={form.displayName}
                onChange={e => updateField('displayName', e.target.value)}
                placeholder="Name shown on requests"
                required
              />
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Contact and defaults</h2>
            <p className={styles.helperText}>Saved defaults help prefill future requests and quote acceptances.</p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">Phone</label>
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
              <label className={styles.label} htmlFor="preferredDistrict">Preferred district</label>
              <select
                id="preferredDistrict"
                className={styles.input}
                value={form.preferredDistrict}
                onChange={e => updateField('preferredDistrict', e.target.value)}
              >
                <option value="">No default district</option>
                {districtsData.districts.map(district => (
                  <option key={district.roman} value={district.roman}>
                    District {district.roman} - {district.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="address">Default address</label>
              <textarea
                id="address"
                className={styles.textarea}
                value={form.address}
                onChange={e => updateField('address', e.target.value)}
                placeholder="Street, building, access notes"
                rows={4}
              />
              <p className={styles.helperText}>Shared with a pro only when you accept their quote and include it in the acceptance details.</p>
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Sign-in details</h2>
            <p className={styles.helperText}>These fields come from your sign-in account and cannot be edited here.</p>

            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input id="email" className={styles.input} value={profile?.email ?? user?.email ?? ''} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="emailVerified">Email status</label>
                <input
                  id="emailVerified"
                  className={styles.input}
                  value={(profile?.emailVerified ?? user?.emailVerified) ? 'Verified' : 'Not verified'}
                  disabled
                />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="uid">Account ID</label>
              <input id="uid" className={styles.input} value={profile?.uid ?? user?.uid ?? ''} disabled />
            </div>
          </section>

          <section className={`${styles.card} ${styles.actionCard}`}>
            {error && <p className={styles.errorText}>{error}</p>}
            {saved && <p className={styles.successText}>Changes saved.</p>}

            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </section>
        </form>
      </div>
    </div>
  )
}

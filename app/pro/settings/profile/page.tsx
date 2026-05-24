'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FaFacebookF, FaGlobe, FaInstagram, FaLinkedinIn, FaTiktok } from 'react-icons/fa'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from '../../../account/account.module.css'

type PricingType = 'hourly' | 'fixed' | 'quote'

type SocialLinks = {
  website: string
  facebook: string
  instagram: string
  linkedin: string
  tiktok: string
}

type Faqs = {
  pricing: string
  process: string
  advice: string
}

type ProfileForm = {
  fullName: string
  phone: string
  categoryName: string
  bio: string
  yearsExp: string
  pricingType: PricingType
  hourlyRate: string
  services: string
  districts: string
  radius: string
  postcode: string
  availability: string
  paymentMethods: string[]
  socialLinks: SocialLinks
  faqs: Faqs
}

const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Card', 'Online payment']
const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website or portfolio', placeholder: 'https://example.hu', Icon: FaGlobe },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...', Icon: FaFacebookF },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...', Icon: FaInstagram },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...', Icon: FaLinkedinIn },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...', Icon: FaTiktok },
] as const

const EMPTY_FORM: ProfileForm = {
  fullName: '',
  phone: '',
  categoryName: '',
  bio: '',
  yearsExp: '',
  pricingType: 'quote',
  hourlyRate: '',
  services: '',
  districts: '',
  radius: '10',
  postcode: '',
  availability: '',
  paymentMethods: [],
  socialLinks: {
    website: '',
    facebook: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
  },
  faqs: {
    pricing: '',
    process: '',
    advice: '',
  },
}

function join(value?: Array<string | number>) {
  return value?.join(', ') ?? ''
}

function splitStrings(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function splitNumbers(value: string): number[] {
  return splitStrings(value).map(Number).filter(item => Number.isInteger(item) && item > 0)
}

function asPricingType(value: unknown): PricingType {
  return value === 'hourly' || value === 'fixed' || value === 'quote' ? value : 'quote'
}

function cleanObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export default function EditProProfilePage() {
  const router = useRouter()
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/pro/settings/profile')
        return
      }

      try {
        const res = await authenticatedFetch('/api/pro/profile')
        const data = await res.json()
        const profile = cleanObject(data.profile)
        const account = cleanObject(data.account)
        const socialLinks = cleanObject(profile.socialLinks)
        const faqs = cleanObject(profile.faqs)

        setForm({
          fullName: cleanText(profile.fullName),
          phone: cleanText(account.phone),
          categoryName: cleanText(profile.categoryName),
          bio: cleanText(profile.bio),
          yearsExp: cleanText(profile.yearsExp),
          pricingType: asPricingType(profile.pricingType),
          hourlyRate: cleanText(profile.hourlyRate),
          services: join(Array.isArray(profile.services) ? profile.services as string[] : []),
          districts: join(Array.isArray(profile.districts) ? profile.districts as number[] : []),
          radius: profile.radius ? String(profile.radius) : '10',
          postcode: cleanText(profile.postcode),
          availability: join(Array.isArray(profile.availability) ? profile.availability as string[] : []),
          paymentMethods: Array.isArray(profile.paymentMethods) ? profile.paymentMethods.map(String) : [],
          socialLinks: {
            website: cleanText(socialLinks.website),
            facebook: cleanText(socialLinks.facebook),
            instagram: cleanText(socialLinks.instagram),
            linkedin: cleanText(socialLinks.linkedin),
            tiktok: cleanText(socialLinks.tiktok),
          },
          faqs: {
            pricing: cleanText(faqs.pricing),
            process: cleanText(faqs.process),
            advice: cleanText(faqs.advice),
          },
        })
      } catch {
        setError('Could not load your pro profile.')
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  function updateField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function togglePaymentMethod(method: string) {
    setForm(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter(item => item !== method)
        : [...prev.paymentMethods, method],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')

    try {
      await authenticatedFetch('/api/pro/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone,
          bio: form.bio,
          yearsExp: form.yearsExp,
          pricingType: form.pricingType,
          hourlyRate: form.hourlyRate,
          services: splitStrings(form.services),
          districts: splitNumbers(form.districts),
          radius: form.radius,
          postcode: form.postcode,
          availability: splitStrings(form.availability),
          paymentMethods: form.paymentMethods,
          socialLinks: form.socialLinks,
          faqs: form.faqs,
        }),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}><p className={styles.subtitle}>Loading profile editor...</p></div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/pro/settings" className={styles.linkBtn} style={{ marginBottom: '1rem', marginTop: 0, background: '#111827' }}>
          Back to settings
        </Link>
        <h1 className={styles.title}>Edit pro profile</h1>
        <p className={styles.subtitle}>Update the profile information customers see before they request an estimate.</p>

        <div className={styles.card}>
          <form onSubmit={handleSubmit}>
            <section className={styles.helpSection}>
              <h2>Contact</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="fullName">Full name</label>
                <input id="fullName" className={styles.input} value={form.fullName} onChange={e => updateField('fullName', e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="phone">Phone</label>
                <input id="phone" className={styles.input} value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+36..." />
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>Profile basics</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="categoryName">Trade</label>
                <input id="categoryName" className={styles.input} value={form.categoryName || 'Not set'} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="bio">About</label>
                <textarea id="bio" className={styles.input} style={{ minHeight: 180, paddingTop: 12 }} value={form.bio} onChange={e => updateField('bio', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="yearsExp">Years of experience</label>
                <input id="yearsExp" className={styles.input} value={form.yearsExp} onChange={e => updateField('yearsExp', e.target.value)} />
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>Services and area</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="services">Services</label>
                <input id="services" className={styles.input} value={form.services} onChange={e => updateField('services', e.target.value)} placeholder="Cleaning, Deep cleaning" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="districts">District IDs</label>
                <input id="districts" className={styles.input} value={form.districts} onChange={e => updateField('districts', e.target.value)} placeholder="5, 6, 7" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="radius">Travel radius in km</label>
                <input id="radius" className={styles.input} type="number" min={1} value={form.radius} onChange={e => updateField('radius', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="postcode">Home postcode</label>
                <input id="postcode" className={styles.input} value={form.postcode} onChange={e => updateField('postcode', e.target.value)} />
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>Pricing and availability</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="pricingType">Pricing type</label>
                <select id="pricingType" className={styles.input} value={form.pricingType} onChange={e => updateField('pricingType', e.target.value as PricingType)}>
                  <option value="hourly">Hourly rate</option>
                  <option value="fixed">Starting or fixed price</option>
                  <option value="quote">Quote on request</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="hourlyRate">Rate or starting price in Ft</label>
                <input id="hourlyRate" className={styles.input} value={form.hourlyRate} onChange={e => updateField('hourlyRate', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="availability">Availability</label>
                <input id="availability" className={styles.input} value={form.availability} onChange={e => updateField('availability', e.target.value)} placeholder="Monday-Friday, Weekends, Evenings" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payment methods accepted</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {PAYMENT_METHODS.map(method => (
                    <label key={method} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: '#374151' }}>
                      <input type="checkbox" checked={form.paymentMethods.includes(method)} onChange={() => togglePaymentMethod(method)} />
                      {method}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>Social links</h2>
              {SOCIAL_FIELDS.map(({ key, label, placeholder, Icon }) => (
                <div className={styles.field} key={key}>
                  <label className={styles.label} htmlFor={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={15} color="#f97316" />
                    {label}
                  </label>
                  <input
                    id={key}
                    className={styles.input}
                    type="url"
                    value={form.socialLinks[key]}
                    onChange={e => setForm(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: e.target.value } }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </section>

            <section className={styles.helpSection}>
              <h2>Customer FAQ</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="faqPricing">What should the customer know about your pricing?</label>
                <textarea id="faqPricing" className={styles.input} style={{ minHeight: 120, paddingTop: 12 }} value={form.faqs.pricing} onChange={e => setForm(prev => ({ ...prev, faqs: { ...prev.faqs, pricing: e.target.value } }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="faqProcess">What is your typical process for working with a new customer?</label>
                <textarea id="faqProcess" className={styles.input} style={{ minHeight: 120, paddingTop: 12 }} value={form.faqs.process} onChange={e => setForm(prev => ({ ...prev, faqs: { ...prev.faqs, process: e.target.value } }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="faqAdvice">What advice would you give a customer looking to hire a provider in your area of work?</label>
                <textarea id="faqAdvice" className={styles.input} style={{ minHeight: 120, paddingTop: 12 }} value={form.faqs.advice} onChange={e => setForm(prev => ({ ...prev, faqs: { ...prev.faqs, advice: e.target.value } }))} />
              </div>
            </section>

            {error && <p className={styles.errorText}>{error}</p>}
            {saved && <p className={styles.successText}>Profile saved.</p>}
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

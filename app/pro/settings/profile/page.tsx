'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FaFacebookF, FaGlobe, FaInstagram, FaLinkedinIn, FaTiktok } from 'react-icons/fa'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { useTranslations } from '@/lib/i18n/client'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
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

const PAYMENT_METHODS = [
  { value: 'Cash', labelKey: 'paymentCash' },
  { value: 'Bank transfer', labelKey: 'paymentBank' },
  { value: 'Card', labelKey: 'paymentCard' },
  { value: 'Online payment', labelKey: 'paymentOnline' },
] as const
const SOCIAL_FIELDS = [
  { key: 'website', labelKey: 'website', placeholder: 'https://example.hu', Icon: FaGlobe },
  { key: 'facebook', labelKey: 'facebook', placeholder: 'https://facebook.com/...', Icon: FaFacebookF },
  { key: 'instagram', labelKey: 'instagram', placeholder: 'https://instagram.com/...', Icon: FaInstagram },
  { key: 'linkedin', labelKey: 'linkedin', placeholder: 'https://linkedin.com/in/...', Icon: FaLinkedinIn },
  { key: 'tiktok', labelKey: 'tiktok', placeholder: 'https://tiktok.com/@...', Icon: FaTiktok },
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
  const t = useTranslations()
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
        setError(t('proProfileEdit.errors.load'))
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
      setError(err instanceof Error ? err.message : t('proProfileEdit.errors.save'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}><p className={styles.subtitle}>{t('proProfileEdit.loading')}</p></div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/pro/settings" className={styles.linkBtn} style={{ marginBottom: '1rem', marginTop: 0, background: '#111827' }}>
          {t('proProfileEdit.back')}
        </Link>
        <h1 className={styles.title}>{t('proProfileEdit.title')}</h1>
        <p className={styles.subtitle}>{t('proProfileEdit.subtitle')}</p>
        <ProUpgradeCta variant="inline" className="mb-4" />

        <div className={styles.card}>
          <form onSubmit={handleSubmit}>
            <section className={styles.helpSection}>
              <h2>{t('proProfileEdit.contact')}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="fullName">{t('proProfileEdit.fullName')}</label>
                <input id="fullName" className={styles.input} value={form.fullName} onChange={e => updateField('fullName', e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="phone">{t('proProfileEdit.phone')}</label>
                <input id="phone" className={styles.input} value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="+36..." />
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>{t('proProfileEdit.profileBasics')}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="categoryName">{t('proProfileEdit.trade')}</label>
                <input id="categoryName" className={styles.input} value={form.categoryName || t('proProfileEdit.notSet')} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="bio">{t('proProfileEdit.about')}</label>
                <textarea id="bio" className={styles.input} style={{ minHeight: 180, paddingTop: 12 }} value={form.bio} onChange={e => updateField('bio', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="yearsExp">{t('proProfileEdit.years')}</label>
                <input id="yearsExp" className={styles.input} value={form.yearsExp} onChange={e => updateField('yearsExp', e.target.value)} />
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>{t('proProfileEdit.servicesArea')}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="services">{t('proProfileEdit.services')}</label>
                <input id="services" className={styles.input} value={form.services} onChange={e => updateField('services', e.target.value)} placeholder={t('proProfileEdit.servicesPlaceholder')} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="districts">{t('proProfileEdit.districts')}</label>
                <input id="districts" className={styles.input} value={form.districts} onChange={e => updateField('districts', e.target.value)} placeholder={t('proProfileEdit.districtsPlaceholder')} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="radius">{t('proProfileEdit.radius')}</label>
                <input id="radius" className={styles.input} type="number" min={1} value={form.radius} onChange={e => updateField('radius', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="postcode">{t('proProfileEdit.postcode')}</label>
                <input id="postcode" className={styles.input} value={form.postcode} onChange={e => updateField('postcode', e.target.value)} />
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>{t('proProfileEdit.pricingAvailability')}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="pricingType">{t('proProfileEdit.pricingType')}</label>
                <select id="pricingType" className={styles.input} value={form.pricingType} onChange={e => updateField('pricingType', e.target.value as PricingType)}>
                  <option value="hourly">{t('proProfileEdit.pricing.hourly')}</option>
                  <option value="fixed">{t('proProfileEdit.pricing.fixed')}</option>
                  <option value="quote">{t('proProfileEdit.pricing.quote')}</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="hourlyRate">{t('proProfileEdit.rate')}</label>
                <input id="hourlyRate" className={styles.input} value={form.hourlyRate} onChange={e => updateField('hourlyRate', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="availability">{t('proProfileEdit.availability')}</label>
                <input id="availability" className={styles.input} value={form.availability} onChange={e => updateField('availability', e.target.value)} placeholder={t('proProfileEdit.availabilityPlaceholder')} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t('proProfileEdit.paymentMethods')}</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {PAYMENT_METHODS.map(method => (
                    <label key={method.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: '#374151' }}>
                      <input type="checkbox" checked={form.paymentMethods.includes(method.value)} onChange={() => togglePaymentMethod(method.value)} />
                      {t(`proSignup.profile.${method.labelKey}`)}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.helpSection}>
              <h2>{t('proProfileEdit.socialLinks')}</h2>
              {SOCIAL_FIELDS.map(({ key, labelKey, placeholder, Icon }) => (
                <div className={styles.field} key={key}>
                  <label className={styles.label} htmlFor={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={15} color="#f97316" />
                    {t(`proProfile.social.${labelKey}`)}
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
              <h2>{t('proProfileEdit.customerFaq')}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="faqPricing">{t('proProfileEdit.faq.pricing')}</label>
                <textarea id="faqPricing" className={styles.input} style={{ minHeight: 120, paddingTop: 12 }} value={form.faqs.pricing} onChange={e => setForm(prev => ({ ...prev, faqs: { ...prev.faqs, pricing: e.target.value } }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="faqProcess">{t('proProfileEdit.faq.process')}</label>
                <textarea id="faqProcess" className={styles.input} style={{ minHeight: 120, paddingTop: 12 }} value={form.faqs.process} onChange={e => setForm(prev => ({ ...prev, faqs: { ...prev.faqs, process: e.target.value } }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="faqAdvice">{t('proProfileEdit.faq.advice')}</label>
                <textarea id="faqAdvice" className={styles.input} style={{ minHeight: 120, paddingTop: 12 }} value={form.faqs.advice} onChange={e => setForm(prev => ({ ...prev, faqs: { ...prev.faqs, advice: e.target.value } }))} />
              </div>
            </section>

            {error && <p className={styles.errorText}>{error}</p>}
            {saved && <p className={styles.successText}>{t('proProfileEdit.saved')}</p>}
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? t('proProfileEdit.saving') : t('proProfileEdit.submit')}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

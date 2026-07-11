'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FaFacebookF, FaGlobe, FaInstagram, FaLinkedinIn, FaTiktok } from 'react-icons/fa'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'
import { compressImageFile } from '@/lib/imageCompression'
import { load, save, stageFile } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const AVAILABILITY = [
  { key: 'availabilityWeekdays', value: 'Monday–Friday' },
  { key: 'availabilityWeekends', value: 'Weekends' },
  { key: 'availabilityEvenings', value: 'Evenings' },
  { key: 'availabilityHolidays', value: 'Public holidays' },
] as const
const PAYMENT_METHODS = [
  { key: 'paymentCash', value: 'Cash' },
  { key: 'paymentBank', value: 'Bank transfer' },
  { key: 'paymentCard', value: 'Card' },
  { key: 'paymentOnline', value: 'Online payment' },
] as const
const MAX_BIO = 1000
const MIN_BIO = 100
const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website or portfolio', labelKey: 'website', placeholder: 'https://example.hu', Icon: FaGlobe },
  { key: 'facebook', label: 'Facebook', labelKey: undefined, placeholder: 'https://facebook.com/...', Icon: FaFacebookF },
  { key: 'instagram', label: 'Instagram', labelKey: undefined, placeholder: 'https://instagram.com/...', Icon: FaInstagram },
  { key: 'linkedin', label: 'LinkedIn', labelKey: undefined, placeholder: 'https://linkedin.com/in/...', Icon: FaLinkedinIn },
  { key: 'tiktok', label: 'TikTok', labelKey: undefined, placeholder: 'https://tiktok.com/@...', Icon: FaTiktok },
] as const satisfies readonly {
  key: keyof SignupSocialLinks
  label: string
  labelKey?: string
  placeholder: string
  Icon: typeof FaGlobe
}[]

type SignupSocialLinks = {
  website: string
  facebook: string
  instagram: string
  linkedin: string
  tiktok: string
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export default function ProfilePage() {
  const t = useTranslations()
  const router = useRouter()
  const data = load()

  // Text fields
  const [bio, setBio] = useState('')
  const [yearsExp, setYearsExp] = useState('')
  const [pricingType, setPricingType] = useState<'hourly' | 'fixed' | 'quote'>('hourly')
  const [hourlyRate, setHourlyRate] = useState('')
  const [availability, setAvailability] = useState<string[]>([])
  const [socialLinks, setSocialLinks] = useState({
    website: '',
    facebook: '',
    instagram: '',
    linkedin: '',
    tiktok: '',
  })
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarState, setAvatarState] = useState<UploadState>('idle')

  const initials = data.fullName
    ? data.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'YO'

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarState('uploading')
    try {
      const compressed = await compressImageFile(file)
      setAvatarPreview(URL.createObjectURL(compressed))
      stageFile('avatar', compressed)
      setAvatarState('done')
    } catch {
      setAvatarState('error')
    }
  }

  function toggleAvail(a: string) {
    setAvailability(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }

  function togglePaymentMethod(method: string) {
    setPaymentMethods(prev => prev.includes(method) ? prev.filter(x => x !== method) : [...prev, method])
  }

  const bioOk = bio.length >= MIN_BIO && bio.length <= MAX_BIO
  const canContinue = bioOk && yearsExp && availability.length > 0 &&
    (pricingType === 'quote' || hourlyRate) &&
    avatarState !== 'uploading'

  function handleContinue() {
    save({
      bio,
      yearsExp,
      pricingType,
      hourlyRate,
      availability,
      socialLinks: {
        website: socialLinks.website.trim(),
        facebook: socialLinks.facebook.trim(),
        instagram: socialLinks.instagram.trim(),
        linkedin: socialLinks.linkedin.trim(),
        tiktok: socialLinks.tiktok.trim(),
      },
      paymentMethods,
    })
    router.push('/pro/signup/work')
  }

  return (
    <div className={styles.stepPageWide}>
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.profile.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.profile.subtitle')}
      </p>

      <div className={styles.previewLayout}>
        <div>
          {/* Avatar */}
          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.profile.photo')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width: 72, height: 72, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  overflow: 'hidden', background: avatarPreview ? 'transparent' : '#0ea5e9',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 700, border: '2px solid #e5e7eb',
                }}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt={t('proSignup.profile.avatarAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <div
                className={`${styles.uploadArea} ${avatarState === 'uploading' ? styles.uploadAreaActive : ''}`}
                style={{ flex: 1, padding: '0.875rem', cursor: 'pointer' }}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarState === 'uploading' && <p className={styles.uploadTitle} style={{ marginBottom: 0 }}>{t('proSignup.common.uploading')}</p>}
                {avatarState === 'done' && <p className={styles.uploadTitle} style={{ marginBottom: 0, color: '#16a34a' }}>{t('proSignup.profile.photoUploaded')}</p>}
                {avatarState === 'error' && <p className={styles.uploadTitle} style={{ marginBottom: 0, color: '#ef4444' }}>{t('proSignup.common.uploadFailedRetry')}</p>}
                {avatarState === 'idle' && (
                  <>
                    <p className={styles.uploadTitle} style={{ marginBottom: 0, fontSize: '0.875rem' }}>{t('proSignup.profile.clickToUpload')}</p>
                    <p className={styles.uploadHint}>{t('proSignup.profile.photoHint')}</p>
                  </>
                )}
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Bio */}
          <div className={styles.field}>
            <label className={styles.label}>
              {t('proSignup.profile.bio')} <span className={styles.labelHint}>{t('proSignup.profile.bioHint', { count: bio.length, max: MAX_BIO, min: MIN_BIO })}</span>
            </label>
            <textarea
              className={styles.textarea}
              placeholder={t('proSignup.profile.bioPlaceholder')}
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, MAX_BIO))}
            />
            {bio.length > 0 && bio.length < MIN_BIO && (
              <p style={{ fontSize: '0.8125rem', color: '#ef4444', marginTop: '0.25rem' }}>
                {t('proSignup.profile.bioMinError', { min: MIN_BIO })}
              </p>
            )}
          </div>

          {/* Years exp */}
          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.profile.years')}</label>
            <input className={styles.input} type="number" min={0} max={50} placeholder="e.g. 5"
              value={yearsExp} onChange={e => setYearsExp(e.target.value)} />
          </div>

          {/* Pricing */}
          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.profile.pricing')}</label>
            <div className={styles.pricingGrid}>
              {[
                { id: 'hourly', title: t('proSignup.profile.pricingHourly'), desc: t('proSignup.profile.pricingHourlyDesc') },
                { id: 'fixed', title: t('proSignup.profile.pricingFixed'), desc: t('proSignup.profile.pricingFixedDesc') },
                { id: 'quote', title: t('proSignup.profile.pricingQuote'), desc: t('proSignup.profile.pricingQuoteDesc') },
              ].map(p => (
                <button key={p.id}
                  className={`${styles.pricingCard} ${pricingType === p.id ? styles.pricingCardSelected : ''}`}
                  onClick={() => setPricingType(p.id as 'hourly' | 'fixed' | 'quote')}
                >
                  <p className={styles.pricingCardTitle}>{p.title}</p>
                  <p className={styles.pricingCardDesc}>{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {pricingType !== 'quote' && (
            <div className={styles.field}>
              <label className={styles.label}>{pricingType === 'hourly' ? t('proSignup.profile.hourlyRate') : t('proSignup.profile.startingPrice')}</label>
              <input className={styles.input} type="number"
                placeholder={pricingType === 'hourly' ? 'e.g. 4500' : 'e.g. 15000'}
                value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
            </div>
          )}

          {/* Availability */}
          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.profile.availability')}</label>
            <div className={styles.availRow}>
              {AVAILABILITY.map(a => (
                <button key={a.value}
                  className={`${styles.availChip} ${availability.includes(a.value) ? styles.availChipSelected : ''}`}
                  onClick={() => toggleAvail(a.value)}>{t(`proSignup.profile.${a.key}`)}</button>
              ))}
            </div>
          </div>

          {/* Payment methods */}
          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.profile.paymentMethods')}</label>
            <div className={styles.availRow}>
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method.value}
                  className={`${styles.availChip} ${paymentMethods.includes(method.value) ? styles.availChipSelected : ''}`}
                  onClick={() => togglePaymentMethod(method.value)}
                >
                  {t(`proSignup.profile.${method.key}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Social links */}
          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.profile.social')} <span className={styles.labelHint}>{t('proSignup.common.optional')}</span></label>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {SOCIAL_FIELDS.map(({ key, labelKey, label, placeholder, Icon }) => {
                const fieldLabel = labelKey ? t(`proSignup.profile.${labelKey}`) : label
                return (
                <label key={key} style={{ display: 'grid', gap: '0.375rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: '#374151' }}>
                    <Icon size={15} color="#0ea5e9" />
                    {fieldLabel}
                  </span>
                  <input
                    className={styles.input}
                    type="url"
                    placeholder={placeholder}
                    aria-label={fieldLabel}
                    value={socialLinks[key]}
                    onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </label>
                )
              })}
            </div>
          </div>

          <button className={styles.continueBtn} style={dg} disabled={!canContinue} onClick={handleContinue}>
            {avatarState === 'uploading' ? t('proSignup.common.uploading') : t('proSignup.common.continue')}
          </button>
        </div>

        {/* Live preview */}
        <div>
          <div className={styles.previewCard}>
            <div className={styles.previewCardHeader}>{t('proSignup.profile.livePreview')}</div>
            <div className={styles.previewCardBody}>
              {avatarPreview
                ? <img src={avatarPreview} alt={t('proSignup.profile.avatarAlt')} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: '0.75rem', border: '2px solid #f3f4f6' }} />
                : <div className={styles.previewAvatar}>{initials}</div>}
              <p className={styles.previewName}>{data.fullName || t('proSignup.profile.yourName')}</p>
              <p className={styles.previewMeta}>
                {data.categoryName ? translateCategory(t, data.categoryName) : t('proSignup.profile.yourTrade')} · {yearsExp ? t('proSignup.profile.yearsExp', { years: yearsExp }) : t('proSignup.profile.experience')}
              </p>
              {bio
                ? <p className={styles.previewBio}>{bio}</p>
                : <p className={styles.previewBio} style={{ color: '#d1d5db' }}>{t('proSignup.profile.bioPreview')}</p>}
              {pricingType !== 'quote' && hourlyRate && (
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0ea5e9', marginTop: '0.75rem' }}>
                  {Number(hourlyRate).toLocaleString('hu-HU')} Ft {pricingType === 'hourly' ? t('proSignup.profile.perHour') : t('proSignup.profile.starting')}
                </p>
              )}
              {pricingType === 'quote' && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.75rem' }}>{t('proSignup.profile.quoteOnRequest')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

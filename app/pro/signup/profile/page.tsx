'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from 'firebase/auth'
import { FaFacebookF, FaGlobe, FaInstagram, FaLinkedinIn, FaTiktok } from 'react-icons/fa'
import { auth } from '@/firebase/index'
import { uploadProFile } from '@/firebase/storage'
import { load, save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const AVAILABILITY = ['Monday–Friday', 'Weekends', 'Evenings', 'Public holidays']
const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Card', 'Online payment']
const MAX_BIO = 1000
const MIN_BIO = 100
const SOCIAL_FIELDS = [
  { key: 'website', label: 'Website or portfolio', placeholder: 'https://example.hu', Icon: FaGlobe },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...', Icon: FaFacebookF },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...', Icon: FaInstagram },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/...', Icon: FaLinkedinIn },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...', Icon: FaTiktok },
] as const

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export default function ProfilePage() {
  const router = useRouter()
  const data = load()
  const uid = auth.currentUser?.uid

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
    if (!file || !uid) return
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarState('uploading')
    try {
      const url = await uploadProFile(uid, 'avatar', file)
      save({ avatarUrl: url })
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url })
      }
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
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Build your profile</h1>
      <p className={styles.stepSubtitle}>
        This is what customers see when they find you. A complete, honest profile gets significantly more enquiries.
      </p>

      <div className={styles.previewLayout}>
        <div>
          {/* Avatar */}
          <div className={styles.field}>
            <label className={styles.label}>Profile photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                onClick={() => avatarInputRef.current?.click()}
                style={{
                  width: 72, height: 72, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                  overflow: 'hidden', background: avatarPreview ? 'transparent' : '#f97316',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: 700, border: '2px solid #e5e7eb',
                }}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials}
              </div>
              <div
                className={`${styles.uploadArea} ${avatarState === 'uploading' ? styles.uploadAreaActive : ''}`}
                style={{ flex: 1, padding: '0.875rem', cursor: 'pointer' }}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarState === 'uploading' && <p className={styles.uploadTitle} style={{ marginBottom: 0 }}>Uploading…</p>}
                {avatarState === 'done' && <p className={styles.uploadTitle} style={{ marginBottom: 0, color: '#16a34a' }}>✓ Photo uploaded</p>}
                {avatarState === 'error' && <p className={styles.uploadTitle} style={{ marginBottom: 0, color: '#ef4444' }}>Upload failed — try again</p>}
                {avatarState === 'idle' && (
                  <>
                    <p className={styles.uploadTitle} style={{ marginBottom: 0, fontSize: '0.875rem' }}>Click to upload</p>
                    <p className={styles.uploadHint}>JPG or PNG, at least 400×400px</p>
                  </>
                )}
              </div>
            </div>
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          {/* Bio */}
          <div className={styles.field}>
            <label className={styles.label}>
              Bio <span className={styles.labelHint}>{bio.length}/{MAX_BIO} chars (min {MIN_BIO})</span>
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Describe your experience, what makes you stand out, and how you work. Customers read this before they contact you."
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, MAX_BIO))}
            />
            {bio.length > 0 && bio.length < MIN_BIO && (
              <p style={{ fontSize: '0.8125rem', color: '#ef4444', marginTop: '0.25rem' }}>
                Please write at least {MIN_BIO} characters.
              </p>
            )}
          </div>

          {/* Years exp */}
          <div className={styles.field}>
            <label className={styles.label}>Years of experience</label>
            <input className={styles.input} type="number" min={0} max={50} placeholder="e.g. 5"
              value={yearsExp} onChange={e => setYearsExp(e.target.value)} />
          </div>

          {/* Pricing */}
          <div className={styles.field}>
            <label className={styles.label}>Pricing structure</label>
            <div className={styles.pricingGrid}>
              {[
                { id: 'hourly', title: 'Hourly rate', desc: 'You charge per hour' },
                { id: 'fixed', title: 'Fixed price', desc: 'Set price per job type' },
                { id: 'quote', title: 'Quote on request', desc: 'You assess first' },
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
              <label className={styles.label}>{pricingType === 'hourly' ? 'Hourly rate (Ft)' : 'Starting price (Ft)'}</label>
              <input className={styles.input} type="number"
                placeholder={pricingType === 'hourly' ? 'e.g. 4500' : 'e.g. 15000'}
                value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
            </div>
          )}

          {/* Availability */}
          <div className={styles.field}>
            <label className={styles.label}>Availability</label>
            <div className={styles.availRow}>
              {AVAILABILITY.map(a => (
                <button key={a}
                  className={`${styles.availChip} ${availability.includes(a) ? styles.availChipSelected : ''}`}
                  onClick={() => toggleAvail(a)}>{a}</button>
              ))}
            </div>
          </div>

          {/* Payment methods */}
          <div className={styles.field}>
            <label className={styles.label}>Payment methods accepted</label>
            <div className={styles.availRow}>
              {PAYMENT_METHODS.map(method => (
                <button
                  key={method}
                  className={`${styles.availChip} ${paymentMethods.includes(method) ? styles.availChipSelected : ''}`}
                  onClick={() => togglePaymentMethod(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Social links */}
          <div className={styles.field}>
            <label className={styles.label}>Social media and website <span className={styles.labelHint}>optional</span></label>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {SOCIAL_FIELDS.map(({ key, label, placeholder, Icon }) => (
                <label key={key} style={{ display: 'grid', gap: '0.375rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, color: '#374151' }}>
                    <Icon size={15} color="#f97316" />
                    {label}
                  </span>
                  <input
                    className={styles.input}
                    type="url"
                    placeholder={placeholder}
                    aria-label={label}
                    value={socialLinks[key]}
                    onChange={e => setSocialLinks(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <button className={styles.continueBtn} style={dg} disabled={!canContinue} onClick={handleContinue}>
            {avatarState === 'uploading' ? 'Uploading…' : 'Continue'}
          </button>
        </div>

        {/* Live preview */}
        <div>
          <div className={styles.previewCard}>
            <div className={styles.previewCardHeader}>Live preview</div>
            <div className={styles.previewCardBody}>
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: '0.75rem', border: '2px solid #f3f4f6' }} />
                : <div className={styles.previewAvatar}>{initials}</div>}
              <p className={styles.previewName}>{data.fullName || 'Your name'}</p>
              <p className={styles.previewMeta}>
                {data.categoryName || 'Your trade'} · {yearsExp ? `${yearsExp} yrs exp` : 'Experience'}
              </p>
              {bio
                ? <p className={styles.previewBio}>{bio}</p>
                : <p className={styles.previewBio} style={{ color: '#d1d5db' }}>Your bio will appear here…</p>}
              {pricingType !== 'quote' && hourlyRate && (
                <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f97316', marginTop: '0.75rem' }}>
                  {Number(hourlyRate).toLocaleString('hu-HU')} Ft {pricingType === 'hourly' ? '/ hr' : 'starting'}
                </p>
              )}
              {pricingType === 'quote' && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.75rem' }}>Quote on request</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

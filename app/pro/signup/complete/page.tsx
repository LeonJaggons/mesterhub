'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateProfile } from 'firebase/auth'
import { load, clear, getStagedFile, getStagedFiles, type SignupData } from '../store'
import { auth } from '@/firebase/index'
import { authenticatedFetch } from '@/firebase/apiClient'
import { uploadProFile } from '@/firebase/storage'
import { useTranslations } from '@/lib/i18n/client'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const CHECKLIST_KEYS = ['checklist1', 'checklist2', 'checklist3', 'checklist4'] as const

export default function CompletePage() {
  const t = useTranslations()
  const router = useRouter()
  const data = load()
  const submittedRef = useRef(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profileUrl, setProfileUrl] = useState('')
  const [shareMessage, setShareMessage] = useState('')

  useEffect(() => {
    if (submittedRef.current) return
    submittedRef.current = true

    async function submitProfile(): Promise<string> {
      const draft: SignupData = { ...data }
      const user = auth.currentUser
      const flags = await fetch('/api/feature-flags', { cache: 'no-store' })
        .then(res => res.json() as Promise<{ phoneNumberVerification?: boolean }>)
        .catch(() => ({ phoneNumberVerification: false }))
      const requirePhoneVerification = Boolean(flags.phoneNumberVerification)

      if (!user) {
        throw new Error(t('proSignup.complete.verifyError'))
      }

      if (requirePhoneVerification && !user.phoneNumber) {
        throw new Error(t('proSignup.complete.verifyError'))
      }

      if (draft.fullName?.trim() && user.displayName !== draft.fullName.trim()) {
        await updateProfile(user, { displayName: draft.fullName.trim() })
      }

      const avatarFile = getStagedFile('avatar')
      if (avatarFile) {
        draft.avatarUrl = await uploadProFile(user.uid, 'avatar', avatarFile)
        await updateProfile(user, { photoURL: draft.avatarUrl })
      }

      const idDocumentFile = getStagedFile('idDocument')
      if (idDocumentFile) draft.idDocumentUrl = await uploadProFile(user.uid, 'id-document', idDocumentFile)

      const selfieFile = getStagedFile('selfie')
      if (selfieFile) draft.selfieUrl = await uploadProFile(user.uid, 'selfie', selfieFile)

      const certificateFile = getStagedFile('certificate')
      if (certificateFile) draft.certificateUrl = await uploadProFile(user.uid, 'credentials/certificate', certificateFile)

      const insuranceFile = getStagedFile('insurance')
      if (insuranceFile) draft.insuranceUrl = await uploadProFile(user.uid, 'credentials/insurance', insuranceFile)

      if (draft.pastProjects?.length) {
        const staged = getStagedFiles()
        draft.pastProjects = await Promise.all(draft.pastProjects.map(async project => {
          const beforeFile = staged.get(`project:${project.id}:before`)
          const afterFile = staged.get(`project:${project.id}:after`)
          return {
            ...project,
            ...(beforeFile ? { beforeUrl: await uploadProFile(user.uid, `projects/${project.id}-before`, beforeFile) } : {}),
            ...(afterFile ? { afterUrl: await uploadProFile(user.uid, `projects/${project.id}-after`, afterFile) } : {}),
          }
        }))
      }

      await authenticatedFetch('/api/pro/signup', {
        method: 'POST',
        body: JSON.stringify({ ...draft, password: '' }),
      })
      window.localStorage.removeItem('mesterhub_pro_referral_code')

      return `${window.location.origin}/pro/${user.uid}`
    }

    submitProfile()
      .then((url) => {
        setProfileUrl(url)
        clear()
        setSaved(true)
        router.refresh()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('proSignup.complete.saveError'))
      })
  }, [data, router, t])

  const firstName = data.fullName?.split(' ')[0] ?? t('proSignup.complete.fallbackName')

  async function handleShareProfile() {
    if (!profileUrl) {
      setShareMessage(t('proSignup.complete.shareNotReady'))
      return
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: t('proSignup.complete.shareTitle'), url: profileUrl })
        setShareMessage('')
        return
      }

      await navigator.clipboard.writeText(profileUrl)
      setShareMessage(t('proSignup.complete.copied'))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setShareMessage(t('proSignup.complete.shareFailed'))
    }
  }

  if (error) {
    return (
      <div className={styles.stepPage}>
        <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', color: '#dc2626' }}>
          <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{t('proSignup.complete.errorTitle')}</p>
          <p style={{ fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!saved) {
    return (
      <div className={styles.stepPage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <p style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>{t('proSignup.complete.saving')}</p>
      </div>
    )
  }

  return (
    <div className={styles.stepPage}>
      <div className={styles.completionCard}>
        <div className={styles.completionIcon}>🎉</div>
        <h1 className={styles.stepTitle} style={{ ...dg, marginBottom: '0.5rem' }}>
          {t('proSignup.complete.title', { name: firstName })}
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#92400e', margin: 0, lineHeight: 1.6 }}>
          {t('proSignup.complete.body')}
        </p>
      </div>

      <h2 style={{ ...dg, fontSize: '1.25rem', fontWeight: 900, color: '#111827', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
        {t('proSignup.complete.howToTitle')}
      </h2>
      <p style={{ fontSize: '0.9375rem', color: '#6b7280', marginBottom: '1.25rem' }}>
        {t('proSignup.complete.howToBody')}
      </p>

      <div className={styles.checklist}>
        {CHECKLIST_KEYS.map((item) => (
          <div key={item} className={styles.checklistItem}>
            <div className={styles.checklistDot} />
            <span>{t(`proSignup.complete.${item}`)}</span>
          </div>
        ))}
      </div>

      <hr className={styles.separator} />

      {data.backgroundCheck && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#15803d' }}>
          <strong>{t('proSignup.complete.backgroundSubmitted')}</strong> {t('proSignup.complete.backgroundBody', { badge: t('proSignup.background.badge') })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Link
          href="/pro/jobs"
          style={{
            display: 'block', width: '100%', padding: '0.9rem', background: '#f97316', color: 'white',
            textAlign: 'center', fontWeight: 700, borderRadius: '0.625rem', textDecoration: 'none',
            fontSize: '1rem', ...dg, transition: 'background 0.15s', letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#ea580c')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f97316')}
        >
          {t('proSignup.complete.dashboard')}
        </Link>

        <button
          onClick={handleShareProfile}
          className={styles.secondaryBtn}
          style={dg}
        >
          {t('proSignup.complete.share')}
        </button>
        {shareMessage && (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>{shareMessage}</p>
        )}
      </div>
    </div>
  )
}

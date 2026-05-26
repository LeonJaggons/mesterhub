'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { load, clear, getStagedFile, getStagedFiles, type SignupData } from '../store'
import { auth } from '@/firebase/index'
import { authenticatedFetch } from '@/firebase/apiClient'
import { uploadProFile } from '@/firebase/storage'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const CHECKLIST = [
  'Respond to enquiries within 1 hour — fast response rate is your single biggest early advantage.',
  'Add past projects if you have not already — profiles with real examples get more views.',
  'Set a competitive starting price. You can always negotiate up on larger jobs.',
  'Share your profile link on WhatsApp and social — your existing network is your first source of reviews.',
]

export default function CompletePage() {
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
      let user = auth.currentUser

      if (!user) {
        if (!draft.email || !draft.password) {
          throw new Error('Account email and password are required. Please return to the account step.')
        }
        const credential = await createUserWithEmailAndPassword(auth, draft.email, draft.password)
        user = credential.user
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
        setError(err instanceof Error ? err.message : 'Failed to save profile.')
      })
  }, [data, router])

  const firstName = data.fullName?.split(' ')[0] ?? 'there'

  async function handleShareProfile() {
    if (!profileUrl) {
      setShareMessage('Your profile link is not ready yet.')
      return
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Mestermind profile', url: profileUrl })
        setShareMessage('')
        return
      }

      await navigator.clipboard.writeText(profileUrl)
      setShareMessage('Profile link copied.')
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setShareMessage('Could not share automatically. Copy the profile link from your browser after opening it.')
    }
  }

  if (error) {
    return (
      <div className={styles.stepPage}>
        <div style={{ padding: '1.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', color: '#dc2626' }}>
          <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Could not save your profile</p>
          <p style={{ fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!saved) {
    return (
      <div className={styles.stepPage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <p style={{ color: '#9ca3af', fontSize: '0.9375rem' }}>Saving your profile…</p>
      </div>
    )
  }

  return (
    <div className={styles.stepPage}>
      <div className={styles.completionCard}>
        <div className={styles.completionIcon}>🎉</div>
        <h1 className={styles.stepTitle} style={{ ...dg, marginBottom: '0.5rem' }}>
          You&apos;re in, {firstName}.
        </h1>
        <p style={{ fontSize: '0.9375rem', color: '#92400e', margin: 0, lineHeight: 1.6 }}>
          Your profile has been submitted and your first month of Mestermind Pro is active. Once identity verification completes, you&apos;ll go live with priority placement, visible reviews, and direct inquiries.
        </p>
      </div>

      <h2 style={{ ...dg, fontSize: '1.25rem', fontWeight: 900, color: '#111827', marginBottom: '0.5rem', letterSpacing: '-0.01em' }}>
        How to land your first job
      </h2>
      <p style={{ fontSize: '0.9375rem', color: '#6b7280', marginBottom: '1.25rem' }}>
        That first review is the hardest. Here&apos;s what moves the needle.
      </p>

      <div className={styles.checklist}>
        {CHECKLIST.map((item, i) => (
          <div key={i} className={styles.checklistItem}>
            <div className={styles.checklistDot} />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <hr className={styles.separator} />

      {data.backgroundCheck && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#15803d' }}>
          <strong>Background check submitted.</strong> Your <em>Háttérellenőrzött</em> badge will appear on your profile once the check completes — usually 1–3 business days.
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
          Go to my dashboard
        </Link>

        <button
          onClick={handleShareProfile}
          className={styles.secondaryBtn}
          style={dg}
        >
          Share my profile
        </button>
        {shareMessage && (
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', textAlign: 'center' }}>{shareMessage}</p>
        )}
      </div>
    </div>
  )
}

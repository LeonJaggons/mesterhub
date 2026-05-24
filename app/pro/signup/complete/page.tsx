'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { load, clear } from '../store'
import { auth } from '@/firebase/index'
import { createProProfile } from '@/firebase/pros'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const CHECKLIST = [
  'Respond to enquiries within 1 hour — fast response rate is your single biggest early advantage.',
  'Add past projects if you have not already — profiles with real examples get more views.',
  'Set a competitive starting price. You can always negotiate up on larger jobs.',
  'Share your profile link on WhatsApp and social — your existing network is your first source of reviews.',
]

export default function CompletePage() {
  const data = load()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const user = auth.currentUser
    if (!user) return
    createProProfile(user.uid, data)
      .then(() => {
        clear()
        setSaved(true)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to save profile.')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const firstName = data.fullName?.split(' ')[0] ?? 'there'

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
          Your profile has been submitted. Once identity verification completes, you&apos;ll go live and start receiving job requests.
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
          href="/"
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
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: 'My Mestermind profile', url: window.location.origin + '/pro/' + data.fullName?.toLowerCase().replace(/\s+/g, '-') })
            }
          }}
          className={styles.secondaryBtn}
          style={dg}
        >
          Share my profile
        </button>
      </div>
    </div>
  )
}

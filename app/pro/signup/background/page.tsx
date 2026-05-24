'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export default function BackgroundPage() {
  const router = useRouter()
  const [opted, setOpted] = useState<boolean | null>(null)

  function handleContinue() {
    save({ backgroundCheck: opted === true })
    router.push('/pro/signup/payout')
  }

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Background check</h1>
      <p className={styles.stepSubtitle}>
        This step is optional at launch. Pros who opt in get a visible <strong>Háttérellenőrzött</strong> badge on their profile — a meaningful trust signal that meaningfully increases enquiry rates.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setOpted(true)}
          style={{
            padding: '1.25rem 1.5rem',
            border: `2px solid ${opted === true ? '#f97316' : '#e5e7eb'}`,
            borderRadius: '0.75rem',
            background: opted === true ? '#fff7ed' : 'white',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', ...dg }}>Yes, run a background check on me</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#f97316', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem' }}>Recommended</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            You&apos;ll receive the <strong>Háttérellenőrzött</strong> badge once the check completes (typically 1–3 business days). Customers filter by this badge.
          </p>
        </button>

        <button
          onClick={() => setOpted(false)}
          style={{
            padding: '1.25rem 1.5rem',
            border: `2px solid ${opted === false ? '#d1d5db' : '#e5e7eb'}`,
            borderRadius: '0.75rem',
            background: 'white',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.15s',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151' }}>Skip for now</span>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.375rem 0 0' }}>
            You can opt in from your dashboard at any time.
          </p>
        </button>
      </div>

      {opted === true && (
        <div className={styles.infoBox}>
          <p className={styles.infoBoxTitle}>What we check</p>
          Criminal record search via a registered Hungarian provider. You&apos;ll be asked to consent and provide your ID number. Results are shared only with you — not publicly displayed.
        </div>
      )}

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={opted === null}
        onClick={handleContinue}
      >
        Continue
      </button>
    </div>
  )
}

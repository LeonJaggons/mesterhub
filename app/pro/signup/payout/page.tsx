'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const COMMISSION = 0.12
const PAYOUT_COLLECTION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PAYOUT_COLLECTION === 'true'

export default function PayoutPage() {
  const router = useRouter()
  const [iban, setIban] = useState('')
  const [jobValue, setJobValue] = useState('15000')

  const gross = Number(jobValue) || 0
  const fee = Math.round(gross * COMMISSION)
  const net = gross - fee

  function handleContinue() {
    save(PAYOUT_COLLECTION_ENABLED ? { iban } : { iban: '' })
    router.push('/pro/signup/complete')
  }

  function formatIban(v: string) {
    const clean = v.replace(/\s/g, '').toUpperCase()
    return clean.replace(/(.{4})/g, '$1 ').trim()
  }

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Pricing & payouts</h1>
      <p className={styles.stepSubtitle}>
        Review pricing and payout expectations. Bank account collection is launch-gated until the payout provider is connected.
      </p>

      {PAYOUT_COLLECTION_ENABLED ? (
        <div className={styles.field}>
          <label className={styles.label}>Hungarian IBAN</label>
          <input
            className={styles.input}
            placeholder="HU00 0000 0000 0000 0000 0000 0000"
            value={iban}
            onChange={e => setIban(formatIban(e.target.value))}
            maxLength={36}
          />
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.375rem' }}>
            Starts with HU followed by 26 digits. Payouts are sent 3 business days after job completion.
          </p>
        </div>
      ) : (
        <div className={styles.infoBox}>
          <p className={styles.infoBoxTitle}>Payout setup comes after approval</p>
          We will collect bank details through the verified payout provider before your first paid job. Do not enter bank details during this preview flow.
        </div>
      )}

      <hr className={styles.separator} />

      <div className={styles.field}>
        <label className={styles.label}>Earnings calculator</label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          Enter a job value to see your take-home after commission.
        </p>
        <div className={styles.inputGroup}>
          <input
            className={styles.input}
            type="number"
            placeholder="Job value (Ft)"
            value={jobValue}
            onChange={e => setJobValue(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem', background: '#f3f4f6', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
            Ft
          </div>
        </div>

        <div className={styles.calcBox}>
          <div className={styles.calcRow}>
            <span>Job value</span>
            <span>{gross.toLocaleString('hu-HU')} Ft</span>
          </div>
          <div className={styles.calcRow}>
            <span>Mestermind commission ({COMMISSION * 100}%)</span>
            <span>− {fee.toLocaleString('hu-HU')} Ft</span>
          </div>
          <div className={styles.calcTotal}>
            <span>You receive</span>
            <span style={{ color: '#f97316' }}>{net.toLocaleString('hu-HU')} Ft</span>
          </div>
        </div>
      </div>

      <hr className={styles.separator} />

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>New pro offer</p>
        For your first 30 days, commission is reduced to 6% — half price — to help you land your first job and first review. That first review is the hardest and most important.
      </div>

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={PAYOUT_COLLECTION_ENABLED && (!iban || iban.replace(/\s/g, '').length < 28)}
        onClick={handleContinue}
      >
        {PAYOUT_COLLECTION_ENABLED ? 'Complete setup' : 'Continue to review'}
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const PAYOUT_COLLECTION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PAYOUT_COLLECTION === 'true'

export default function PayoutPage() {
  const router = useRouter()
  const [iban, setIban] = useState('')

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
        Mestermind Pro is a flat-rate subscription. You keep what customers pay you directly, and the subscription unlocks lead and profile features.
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

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>What the flat rate includes</p>
        Unlimited job inquiries, priority search placement, a verified badge, visible profile reviews, category featuring, and direct customer messages.
      </div>

      <hr className={styles.separator} />

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>Subscribe after approval</p>
        Once your profile is submitted, open Pro settings to subscribe securely through Stripe and activate the paid features.
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

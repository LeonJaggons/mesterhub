'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/client'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const PAYOUT_COLLECTION_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PAYOUT_COLLECTION === 'true'

export default function PayoutPage() {
  const t = useTranslations()
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
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.payout.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.payout.subtitle')}
      </p>

      {PAYOUT_COLLECTION_ENABLED ? (
        <div className={styles.field}>
          <label className={styles.label}>{t('proSignup.payout.iban')}</label>
          <input
            className={styles.input}
            placeholder="HU00 0000 0000 0000 0000 0000 0000"
            value={iban}
            onChange={e => setIban(formatIban(e.target.value))}
            maxLength={36}
          />
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.375rem' }}>
            {t('proSignup.payout.ibanHint')}
          </p>
        </div>
      ) : (
        <div className={styles.infoBox}>
          <p className={styles.infoBoxTitle}>{t('proSignup.payout.setupAfterApprovalTitle')}</p>
          {t('proSignup.payout.setupAfterApprovalBody')}
        </div>
      )}

      <hr className={styles.separator} />

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>{t('proSignup.payout.flatRateTitle')}</p>
        {t('proSignup.payout.flatRateBody')}
      </div>

      <hr className={styles.separator} />

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>{t('proSignup.payout.subscribeTitle')}</p>
        {t('proSignup.payout.subscribeBody')}
      </div>

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={PAYOUT_COLLECTION_ENABLED && (!iban || iban.replace(/\s/g, '').length < 28)}
        onClick={handleContinue}
      >
        {PAYOUT_COLLECTION_ENABLED ? t('proSignup.payout.complete') : t('proSignup.payout.review')}
      </button>
    </div>
  )
}

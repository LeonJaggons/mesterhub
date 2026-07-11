'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/client'
import { save } from '../store'
import styles from '../signup.module.css'
import { dg } from '@/lib/ui'


export default function BackgroundPage() {
  const t = useTranslations()
  const router = useRouter()
  const [opted, setOpted] = useState<boolean | null>(null)

  function handleContinue() {
    save({ backgroundCheck: opted === true })
    router.push('/pro/signup/payout')
  }

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.background.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.background.subtitle', { badge: t('proSignup.background.badge') })}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
        <button
          onClick={() => setOpted(true)}
          style={{
            padding: '1.25rem 1.5rem',
            border: `2px solid ${opted === true ? '#0ea5e9' : '#e5e7eb'}`,
            borderRadius: '0.75rem',
            background: opted === true ? '#f0f9ff' : 'white',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827', ...dg }}>{t('proSignup.background.yes')}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#0ea5e9', color: 'white', borderRadius: '1rem', padding: '0.2rem 0.6rem' }}>{t('proSignup.background.recommended')}</span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            {t('proSignup.background.yesBody', { badge: t('proSignup.background.badge') })}
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
          <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#374151' }}>{t('proSignup.background.skip')}</span>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: '0.375rem 0 0' }}>
            {t('proSignup.background.skipBody')}
          </p>
        </button>
      </div>

      {opted === true && (
        <div className={styles.infoBox}>
          <p className={styles.infoBoxTitle}>{t('proSignup.background.checkTitle')}</p>
          {t('proSignup.background.checkBody')}
        </div>
      )}

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={opted === null}
        onClick={handleContinue}
      >
        {t('proSignup.common.continue')}
      </button>
    </div>
  )
}

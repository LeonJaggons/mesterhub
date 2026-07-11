'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/client'
import { save } from '../store'
import styles from '../signup.module.css'
import { dg } from '@/lib/ui'


export default function FaqPage() {
  const t = useTranslations()
  const router = useRouter()
  const [faqs, setFaqs] = useState({
    pricing: '',
    process: '',
    advice: '',
  })

  function handleContinue() {
    save({
      faqs: {
        pricing: faqs.pricing.trim(),
        process: faqs.process.trim(),
        advice: faqs.advice.trim(),
      },
    })
    router.push('/pro/signup/verification')
  }

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.faq.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.faq.subtitle')}
      </p>

      <div className={styles.field}>
        <label className={styles.label}>
          {t('proSignup.faq.pricing')}
        </label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 120 }}
          value={faqs.pricing}
          onChange={e => setFaqs(prev => ({ ...prev, pricing: e.target.value }))}
          placeholder={t('proSignup.faq.pricingPlaceholder')}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          {t('proSignup.faq.process')}
        </label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 120 }}
          value={faqs.process}
          onChange={e => setFaqs(prev => ({ ...prev, process: e.target.value }))}
          placeholder={t('proSignup.faq.processPlaceholder')}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          {t('proSignup.faq.advice')}
        </label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 120 }}
          value={faqs.advice}
          onChange={e => setFaqs(prev => ({ ...prev, advice: e.target.value }))}
          placeholder={t('proSignup.faq.advicePlaceholder')}
        />
      </div>

      <button className={styles.continueBtn} style={dg} onClick={handleContinue}>
        {faqs.pricing || faqs.process || faqs.advice ? t('proSignup.common.continue') : t('proSignup.common.skipForNow')}
      </button>
    </div>
  )
}

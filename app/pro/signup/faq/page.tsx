'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export default function FaqPage() {
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
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Answer common questions</h1>
      <p className={styles.stepSubtitle}>
        These answers appear on your public profile and help customers understand how you price, plan, and work.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>
          What should the customer know about your pricing (e.g., discounts, fees)?
        </label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 120 }}
          value={faqs.pricing}
          onChange={e => setFaqs(prev => ({ ...prev, pricing: e.target.value }))}
          placeholder="Mention call-out fees, discounts, material costs, minimum job size, or when the final price may change."
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          What is your typical process for working with a new customer?
        </label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 120 }}
          value={faqs.process}
          onChange={e => setFaqs(prev => ({ ...prev, process: e.target.value }))}
          placeholder="Explain how you scope the job, confirm details, prepare materials, schedule work, and follow up."
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          What advice would you give a customer looking to hire a provider in your area of work?
        </label>
        <textarea
          className={styles.textarea}
          style={{ minHeight: 120 }}
          value={faqs.advice}
          onChange={e => setFaqs(prev => ({ ...prev, advice: e.target.value }))}
          placeholder="Share what customers should check, prepare, compare, or ask before choosing someone."
        />
      </div>

      <button className={styles.continueBtn} style={dg} onClick={handleContinue}>
        {faqs.pricing || faqs.process || faqs.advice ? 'Continue' : 'Skip for now'}
      </button>
    </div>
  )
}

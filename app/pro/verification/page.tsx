'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from '../../account/account.module.css'

type VerificationData = {
  status?: string
  reason?: string
  reviewedByEmail?: string | null
}

export default function ProVerificationPage() {
  const router = useRouter()
  const [verification, setVerification] = useState<VerificationData | null>(null)
  const [profileStatus, setProfileStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/pro/verification')
        return
      }
      try {
        const res = await authenticatedFetch('/api/pro/profile')
        const data = await res.json()
        setVerification(data.verification ?? {})
        setProfileStatus(data.profile?.status ?? '')
      } catch {
        setVerification(null)
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}><p className={styles.subtitle}>Loading verification...</p></div>
      </main>
    )
  }

  const status = verification?.status ?? profileStatus

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>ID & verification</h1>
        <p className={styles.subtitle}>Track your approval status and what customers see.</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>Current status</h2>
            <p>{status === 'active' ? 'Your profile is approved and visible in search.' : `Your profile status is ${status || 'pending_verification'}.`}</p>
          </section>
          {verification?.reason && (
            <section className={styles.helpSection}>
              <h2>Admin note</h2>
              <p>{verification.reason}</p>
            </section>
          )}
          <section className={styles.helpSection}>
            <h2>Need to update documents?</h2>
            <p>Email support with your account email. Document re-upload can be handled manually during MVP launch.</p>
          </section>
        </div>
      </div>
    </main>
  )
}

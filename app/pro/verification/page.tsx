'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { useTranslations } from '@/lib/i18n/client'
import styles from '../../account/account.module.css'

type VerificationData = {
  status?: string
  reason?: string
  reviewedByEmail?: string | null
}

export default function ProVerificationPage() {
  const router = useRouter()
  const t = useTranslations()
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
        <div className={styles.wrap}><p className={styles.subtitle}>{t('proVerificationPage.loading')}</p></div>
      </main>
    )
  }

  const status = verification?.status ?? profileStatus

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('proVerificationPage.title')}</h1>
        <p className={styles.subtitle}>{t('proVerificationPage.subtitle')}</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>{t('proVerificationPage.currentStatus')}</h2>
            <p>{status === 'active' ? t('proVerificationPage.approved') : t('proVerificationPage.status', { status: status || t('proVerificationPage.pending') })}</p>
          </section>
          {verification?.reason && (
            <section className={styles.helpSection}>
              <h2>{t('proVerificationPage.adminNote')}</h2>
              <p>{verification.reason}</p>
            </section>
          )}
          <section className={styles.helpSection}>
            <h2>{t('proVerificationPage.updateTitle')}</h2>
            <p>{t('proVerificationPage.updateBody')}</p>
          </section>
        </div>
      </div>
    </main>
  )
}

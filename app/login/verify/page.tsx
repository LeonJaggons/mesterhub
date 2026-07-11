'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/firebase/index'
import { useTranslations } from '@/lib/i18n/client'
import styles from '../page.module.css'
import { dg } from '@/lib/ui'


function VerifyLoginContent() {
  const router = useRouter()
  const t = useTranslations()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'checking' | 'needs-email' | 'done' | 'error'>('checking')
  const [error, setError] = useState('')

  useEffect(() => {
    queueMicrotask(() => {
      const storedEmail = window.localStorage.getItem('emailForSignIn') ?? ''
      if (storedEmail) {
        completeSignIn(storedEmail)
      } else {
        setStatus('needs-email')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function completeSignIn(value: string) {
    setStatus('checking')
    setError('')
    try {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        throw new Error(t('loginVerify.errors.invalid'))
      }
      await signInWithEmailLink(auth, value, window.location.href)
      window.localStorage.removeItem('emailForSignIn')
      setStatus('done')
      router.replace(searchParams.get('next') ?? '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginVerify.errors.complete'))
      setStatus('error')
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title} style={dg}>{t('loginVerify.title')}</h1>
        <section className={styles.card}>

        {status === 'checking' && (
          <p>{t('loginVerify.checking')}</p>
        )}

        {status === 'needs-email' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              completeSignIn(email)
            }}
          >
            <p>{t('loginVerify.emailPrompt')}</p>
            <label className={styles.label}>
              {t('loginVerify.email')}
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={styles.input}
              />
            </label>
            <button type="submit" className={styles.submitBtn}>{t('loginVerify.finish')}</button>
          </form>
        )}

        {status === 'error' && (
          <>
            <p className={styles.errorText}>{error}</p>
            <Link href="/login" className={styles.submitBtn}>{t('loginVerify.newLink')}</Link>
          </>
        )}
        </section>
      </div>
    </main>
  )
}

export default function VerifyLoginPage() {
  const t = useTranslations()

  return (
    <Suspense fallback={(
      <main className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={styles.title} style={dg}>{t('loginVerify.title')}</h1>
          <section className={styles.card}>
            <p>{t('loginVerify.checking')}</p>
          </section>
        </div>
      </main>
    )}>
      <VerifyLoginContent />
    </Suspense>
  )
}

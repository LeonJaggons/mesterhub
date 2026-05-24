'use client'

import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/firebase/index'
import styles from '../page.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

function VerifyLoginContent() {
  const router = useRouter()
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
        throw new Error('This login link is invalid or expired.')
      }
      await signInWithEmailLink(auth, value, window.location.href)
      window.localStorage.removeItem('emailForSignIn')
      setStatus('done')
      router.replace(searchParams.get('next') ?? '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete login.')
      setStatus('error')
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title} style={dg}>Confirm your login</h1>
        <section className={styles.card}>

        {status === 'checking' && (
          <p>Checking your secure login link...</p>
        )}

        {status === 'needs-email' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              completeSignIn(email)
            }}
          >
            <p>Enter the email address you used to request this link.</p>
            <label className={styles.label}>
              Email
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={styles.input}
              />
            </label>
            <button type="submit" className={styles.submitBtn}>Finish login</button>
          </form>
        )}

        {status === 'error' && (
          <>
            <p className={styles.errorText}>{error}</p>
            <Link href="/login" className={styles.submitBtn}>Request a new link</Link>
          </>
        )}
        </section>
      </div>
    </main>
  )
}

export default function VerifyLoginPage() {
  return (
    <Suspense fallback={(
      <main className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={styles.title} style={dg}>Confirm your login</h1>
          <section className={styles.card}>
            <p>Checking your secure login link...</p>
          </section>
        </div>
      </main>
    )}>
      <VerifyLoginContent />
    </Suspense>
  )
}

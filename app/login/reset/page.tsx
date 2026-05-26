'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Button } from '@base-ui/react/button'
import { resetPassword, verifyResetCode } from '@/firebase/auth'
import { useTranslations } from '@/lib/i18n/client'
import styles from '../page.module.css'

function ResetPasswordContent() {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const oobCode = searchParams.get('oobCode')
  const mode = searchParams.get('mode')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'checking' | 'ready' | 'success' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkCode() {
      if (!oobCode || (mode && mode !== 'resetPassword')) {
        setError(t('loginReset.errors.invalid'))
        setStatus('error')
        return
      }

      try {
        const verifiedEmail = await verifyResetCode(oobCode)
        if (!mounted) return
        setEmail(verifiedEmail)
        setStatus('ready')
      } catch (err: unknown) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : t('loginReset.errors.invalid'))
        setStatus('error')
      }
    }

    checkCode()

    return () => {
      mounted = false
    }
  }, [mode, oobCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!oobCode) return

    setError(null)
    if (password !== confirmPassword) {
      setError(t('loginReset.errors.mismatch'))
      return
    }

    setLoading(true)
    try {
      await resetPassword(oobCode, password)
      setStatus('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('loginReset.errors.reset'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('loginReset.title')}</h1>
        <p className={styles.subtitle}>
          {t('loginReset.subtitle')}
        </p>

        <section className={styles.card}>
          {status === 'checking' && (
            <p className={styles.statusText}>{t('loginReset.checking')}</p>
          )}

          {status === 'ready' && (
            <form onSubmit={handleSubmit}>
              <p className={styles.statusText}>
                {t('loginReset.ready', { email })}
              </p>

              <Field.Root>
                <Field.Label className={styles.label}>{t('loginReset.newPassword')}</Field.Label>
                <Field.Control
                  render={<Input className={styles.input} />}
                  name="new_password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field.Root>

              <div className={styles.fieldGap}>
                <Field.Root>
                  <Field.Label className={styles.label}>{t('loginReset.confirmPassword')}</Field.Label>
                  <Field.Control
                    render={<Input className={styles.input} />}
                    name="confirm_new_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field.Root>
              </div>

              {error && <p className={styles.errorText}>{error}</p>}

              <Button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? t('loginReset.resetting') : t('loginReset.submit')}
              </Button>
            </form>
          )}

          {status === 'success' && (
            <>
              <p className={styles.successText}>{t('loginReset.success')}</p>
              <Link href="/login" className={styles.submitBtn}>{t('loginReset.login')}</Link>
            </>
          )}

          {status === 'error' && (
            <>
              <p className={styles.errorText}>{error}</p>
              <Link href="/login" className={styles.submitBtn}>{t('loginReset.newLink')}</Link>
            </>
          )}
        </section>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  const t = useTranslations()

  return (
    <Suspense fallback={
      <main className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={styles.title}>{t('loginReset.title')}</h1>
          <section className={styles.card}>
            <p className={styles.statusText}>{t('loginReset.checking')}</p>
          </section>
        </div>
      </main>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

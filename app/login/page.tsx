'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Checkbox } from '@base-ui/react/checkbox'
import { Button } from '@base-ui/react/button'
import {
  signIn,
  forgotPassword,
} from '@/firebase/auth'
import { useTranslations } from '@/lib/i18n/client'
import styles from './page.module.css'

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="15.232" y="4.003" width="11.701" height="1.879" rx=".939" transform="rotate(123 15.232 4.003)" />
      <rect x="8.83" y="13.822" width="7.337" height="1.879" rx=".939" transform="rotate(-146 8.83 13.822)" />
      <path d="M8.072 13.306l1.03-1.586.787.512-1.03 1.586z" />
    </svg>
  )
}

function LoginForm() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const redirectTo = next && next.startsWith('/') ? next : '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResetMessage(null)
    setLoading(true)
    try {
      await signIn(email, password, rememberMe)
      router.push(redirectTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.errors.invalid'))
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError(t('login.errors.emailRequired'))
      return
    }
    setError(null)
    setResetMessage(null)
    setResetLoading(true)
    try {
      await forgotPassword(email)
      setResetMessage(t('login.forgotPassword.success', { email: email.trim() }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.errors.reset'))
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('login.title')}</h1>
        <p className={styles.subtitle}>
          {t('login.subtitle')}
        </p>

        <div className={styles.card}>
          <form onSubmit={handleSubmit}>
            <Field.Root>
              <Field.Label className={styles.label}>{t('login.fields.email')}</Field.Label>
              <Field.Control
                render={<Input className={styles.input} />}
                name="login_email"
                type="email"
                placeholder={t('login.fields.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field.Root>

            <div className={styles.fieldGap}>
              <Field.Root>
                <Field.Label className={styles.label}>{t('login.fields.password')}</Field.Label>
                <Field.Control
                  render={<Input className={styles.input} />}
                  name="login_password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field.Root>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}
            {resetMessage && <p className={styles.successText}>{resetMessage}</p>}

            <div className={styles.rememberRow}>
              <label className={styles.checkboxLabel}>
                <Checkbox.Root
                  className={styles.checkboxRoot}
                  name="remember_me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                >
                  <Checkbox.Indicator className={styles.checkboxIndicator}>
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                {t('login.rememberMe')}
              </label>
              <button
                type="button"
                className={styles.forgotBtn}
                onClick={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading ? t('login.forgotPassword.sending') : t('login.forgotPassword.default')}
              </button>
            </div>

            <Button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? t('login.submit.loading') : t('login.submit.default')}
            </Button>
          </form>

          <div className={styles.accountPanel}>
            <p className={styles.panelTitle}>{t('login.panel.title')}</p>
            <ul className={styles.panelList}>
              <li>{t('login.panel.quotes')}</li>
              <li>{t('login.panel.messages')}</li>
              <li>{t('login.panel.account')}</li>
            </ul>
          </div>
        </div>

        <div className={styles.footer}>
          {t('login.footer.prefix')} <Link href="/register">{t('login.footer.register')}</Link>.
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const t = useTranslations()

  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={styles.title}>{t('login.title')}</h1>
          <p className={styles.termsText}>{t('login.loading')}</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

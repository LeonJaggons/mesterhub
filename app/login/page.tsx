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
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next')
  const redirectTo = next && next.startsWith('/') ? next : '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email, password)
      router.push(redirectTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address first.')
      return
    }
    try {
      await forgotPassword(email)
      setError(null)
      alert(`Password reset email sent to ${email}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>
          Log in to manage requests, messages, appointments, and saved projects.
        </p>

        <div className={styles.card}>
          <form onSubmit={handleSubmit}>
            <Field.Root>
              <Field.Label className={styles.label}>Email address</Field.Label>
              <Field.Control
                render={<Input className={styles.input} />}
                name="login_email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field.Root>

            <div className={styles.fieldGap}>
              <Field.Root>
                <Field.Label className={styles.label}>Password</Field.Label>
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

            <div className={styles.rememberRow}>
              <label className={styles.checkboxLabel}>
                <Checkbox.Root className={styles.checkboxRoot} name="remember_me" defaultChecked>
                  <Checkbox.Indicator className={styles.checkboxIndicator}>
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                Remember me
              </label>
              <button
                type="button"
                className={styles.forgotBtn}
                onClick={handleForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Logging in…' : 'Log in'}
            </Button>
          </form>

          <div className={styles.accountPanel}>
            <p className={styles.panelTitle}>What you can do after logging in</p>
            <ul className={styles.panelList}>
              <li>Track quotes and job status in one place.</li>
              <li>Message pros securely through Mestermind.</li>
              <li>Manage appointments, reviews, and account details.</li>
            </ul>
          </div>
        </div>

        <div className={styles.footer}>
          New to Mestermind? <Link href="/register">Create an account</Link>.
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.wrap}>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.termsText}>Loading…</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

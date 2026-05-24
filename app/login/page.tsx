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
  signInWithGoogle,
  signInWithFacebook,
  sendMagicLink,
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

function MagicLinkIcon() {
  return (
    <svg width="28" height="28" fill="currentColor" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.001 24.007L6.251 15h14.967L4.001 24.007zm.004-19.996l17.207 8.99H6.25L4.005 4.01zm21.324 8.883L4.913 2.23a1.966 1.966 0 00-2.153.201 1.97 1.97 0 00-.699 2.048L4.438 14l-2.377 9.523a1.966 1.966 0 00.7 2.046 1.967 1.967 0 002.152.203L25.33 15.107c.414-.216.671-.64.671-1.107 0-.467-.257-.89-.67-1.106z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="28" height="28" fill="none" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M26 14.073C26 7.406 20.627 2 14 2S2 7.406 2 14.073C2 20.098 6.388 25.093 12.125 26v-8.436H9.077v-3.491h3.048v-2.66c0-3.026 1.792-4.698 4.533-4.698 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.931-1.956 1.887v2.265h3.328l-.532 3.49h-2.796V26C21.612 25.095 26 20.1 26 14.073z" fill="#1977F3" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="28" height="28" fill="none" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M25.52 14.272c0-.85-.076-1.669-.218-2.454H14v4.641h6.458a5.52 5.52 0 01-2.394 3.622v3.011h3.878c2.269-2.089 3.578-5.165 3.578-8.82z" fill="#4285F4" fillRule="evenodd" />
      <path d="M14 26.001c3.24 0 5.956-1.074 7.942-2.907l-3.879-3.01c-1.074.72-2.449 1.145-4.063 1.145-3.126 0-5.771-2.111-6.715-4.948H3.276v3.11A11.995 11.995 0 0014 26z" fill="#34A853" fillRule="evenodd" />
      <path d="M7.285 16.281a7.213 7.213 0 01-.376-2.28c0-.79.136-1.56.376-2.28V8.612H3.276A11.996 11.996 0 002 14.002c0 1.935.464 3.768 1.276 5.388l4.01-3.109z" fill="#FBBC05" fillRule="evenodd" />
      <path d="M14 6.773c1.761 0 3.343.605 4.587 1.794l3.442-3.442C19.95 3.19 17.234 2 13.999 2 9.31 2 5.252 4.69 3.277 8.61l4.01 3.11C8.228 8.884 10.873 6.773 14 6.773z" fill="#EA4335" fillRule="evenodd" />
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
  const [magicSent, setMagicSent] = useState(false)

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

  async function handleMagicLink() {
    if (!email) {
      setError('Enter your email address first.')
      return
    }
    setError(null)
    try {
      await sendMagicLink(email, redirectTo)
      setMagicSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send magic link.')
    }
  }

  async function handleGoogle() {
    setError(null)
    try {
      await signInWithGoogle()
      router.push(redirectTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  async function handleFacebook() {
    setError(null)
    try {
      await signInWithFacebook()
      router.push(redirectTo)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Welcome back</h1>

        <div className={styles.card}>
          {magicSent ? (
            <p className={styles.termsText}>
              Check your inbox — we sent a sign-in link to <strong>{email}</strong>.
            </p>
          ) : (
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
          )}

          <div className={styles.divider}>or</div>

          <p className={styles.termsText}>
            By clicking Continue with magic link, Facebook, or Google, you agree to the{' '}
            <Link href="/terms" target="_blank">Terms of Use</Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank">Privacy Policy</Link>.{' '}
            We&apos;ll keep you logged in.
          </p>

          <Button type="button" className={styles.socialBtn} onClick={handleMagicLink}>
            <MagicLinkIcon />
            Continue with magic link
          </Button>

          <Button type="button" className={styles.socialBtn} onClick={handleFacebook}>
            <FacebookIcon />
            Continue with Facebook
          </Button>

          <Button type="button" className={styles.socialBtn} onClick={handleGoogle}>
            <GoogleIcon />
            Continue with Google
          </Button>

        </div>

        <p className={styles.footer}>
          Don&apos;t have an account? <Link href="/register">Sign up.</Link>
        </p>
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

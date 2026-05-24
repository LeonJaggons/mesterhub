'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Checkbox } from '@base-ui/react/checkbox'
import { Button } from '@base-ui/react/button'
import { signUp, signInWithGoogle, signInWithFacebook } from '@/firebase/auth'
import styles from './page.module.css'

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

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <rect x="15.232" y="4.003" width="11.701" height="1.879" rx=".939" transform="rotate(123 15.232 4.003)" />
      <rect x="8.83" y="13.822" width="7.337" height="1.879" rx=".939" transform="rotate(-146 8.83 13.822)" />
      <path d="M8.072 13.306l1.03-1.586.787.512-1.03 1.586z" />
    </svg>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.firstName, form.lastName)
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    try {
      await signInWithGoogle()
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  async function handleFacebook() {
    setError(null)
    try {
      await signInWithFacebook()
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className={styles.page}>
    <div className={styles.wrap}>
      <h1 className={styles.title}>Create your account</h1>

      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <ol className={styles.fieldList}>
            <li>
              <div className={styles.fieldRow}>
                <div className={styles.fieldRowItem}>
                  <Field.Root>
                    <Field.Label className={styles.label}>First name</Field.Label>
                    <Field.Control
                      render={<Input className={styles.input} />}
                      name="firstName"
                      type="text"
                      value={form.firstName}
                      onChange={handleChange}
                      required
                    />
                  </Field.Root>
                </div>
                <div className={styles.fieldRowItem}>
                  <Field.Root>
                    <Field.Label className={styles.label}>Last name</Field.Label>
                    <Field.Control
                      render={<Input className={styles.input} />}
                      name="lastName"
                      type="text"
                      value={form.lastName}
                      onChange={handleChange}
                      required
                    />
                  </Field.Root>
                </div>
              </div>
            </li>

            <li className={styles.fieldItem}>
              <Field.Root>
                <Field.Label className={styles.label}>Email</Field.Label>
                <Field.Control
                  render={<Input className={styles.input} />}
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </Field.Root>
            </li>

            <li className={styles.fieldItem}>
              <Field.Root>
                <Field.Label className={styles.label}>Password</Field.Label>
                <Field.Control
                  render={<Input className={styles.input} />}
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                />
              </Field.Root>
              <div className={styles.passwordHints}>
                <p className={styles.passwordHintTitle}>Your password must:</p>
                <ul className={styles.passwordHintList}>
                  <li>be 8 to 72 characters long</li>
                  <li>not contain your name or email</li>
                  <li>not be commonly used, easily guessed or contain any variation of the word &ldquo;Mestermind&rdquo;</li>
                </ul>
              </div>
            </li>

            {error && (
              <li>
                <p className={styles.errorText}>{error}</p>
              </li>
            )}

            <li>
              <p className={styles.termsText}>
                By clicking Create Account, you agree to the{' '}
                <Link href="/terms" target="_blank">Terms of Use</Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank">Privacy Policy</Link>.
              </p>
            </li>

            <li>
              <label className={styles.checkboxLabel}>
                <Checkbox.Root className={styles.checkboxRoot} name="remember_me" defaultChecked>
                  <Checkbox.Indicator className={styles.checkboxIndicator}>
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                Remember me
              </label>
            </li>

            <li>
              <Button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </li>
          </ol>

          <div className={styles.divider}>or</div>

          <p className={styles.termsText}>
            By clicking Sign up with Facebook or Sign up with Google, you agree to the{' '}
            <Link href="/terms" target="_blank">Terms of Use</Link>{' '}
            and{' '}
            <Link href="/privacy" target="_blank">Privacy Policy</Link>.{' '}
            We&apos;ll keep you logged in.
          </p>

          <Button type="button" className={styles.socialBtn} onClick={handleFacebook}>
            <FacebookIcon />
            Sign up with Facebook
          </Button>

          <Button type="button" className={styles.socialBtn} onClick={handleGoogle}>
            <GoogleIcon />
            Sign up with Google
          </Button>
        </form>
      </div>

      <p className={styles.footer}>
        Already have an account? <Link href="/login">Log in</Link>.
      </p>
    </div>
    </div>
  )
}

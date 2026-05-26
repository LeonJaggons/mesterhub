'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import { Checkbox } from '@base-ui/react/checkbox'
import { Button } from '@base-ui/react/button'
import { normalizeHungarianPhone, sendPhoneVerificationCode, signUp, signUpWithVerifiedPhone } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
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

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  })
  const [verificationId, setVerificationId] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [codeSentTo, setCodeSentTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [flagsLoaded, setFlagsLoaded] = useState(false)
  const [requirePhoneVerification, setRequirePhoneVerification] = useState(false)
  const phoneNumber = normalizeHungarianPhone(form.phone)
  const phoneCodeReady = !requirePhoneVerification || (Boolean(verificationId) && phoneCode.trim().length === 6)

  useEffect(() => {
    let active = true
    fetch('/api/feature-flags', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setRequirePhoneVerification(Boolean(data.phoneNumberVerification))
      })
      .catch(() => {
        if (active) setRequirePhoneVerification(false)
      })
      .finally(() => {
        if (active) setFlagsLoaded(true)
      })

    return () => {
      active = false
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSendPhoneCode() {
    setError(null)
    setSendingCode(true)
    try {
      const id = await sendPhoneVerificationCode(form.phone, 'customer-phone-recaptcha')
      setVerificationId(id)
      setCodeSentTo(phoneNumber)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send verification code.')
    } finally {
      setSendingCode(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (requirePhoneVerification && !phoneCodeReady) {
      setError('Verify your phone number before creating your account.')
      return
    }
    setLoading(true)
    try {
      const user = requirePhoneVerification
        ? await signUpWithVerifiedPhone(
            form.email,
            form.password,
            form.firstName,
            form.lastName,
            { verificationId, code: phoneCode },
            rememberMe,
          )
        : await signUp(form.email, form.password, form.firstName, form.lastName, rememberMe)
      await authenticatedFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: `${form.firstName} ${form.lastName}`.trim(),
          firstName: form.firstName,
          lastName: form.lastName,
          phone: user.phoneNumber ?? phoneNumber,
        }),
      })
      router.push('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
    <div className={styles.wrap}>
      <h1 className={styles.title}>Create your account</h1>
      <p className={styles.subtitle}>
        Join Mestermind to find trusted local pros, save projects, and manage every request from one place.
      </p>

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

            {requirePhoneVerification && (
              <li className={styles.fieldItem}>
                <Field.Root>
                  <Field.Label className={styles.label}>Phone number</Field.Label>
                  <div className={styles.phoneRow}>
                    <Field.Control
                      render={<Input className={styles.input} />}
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="+36 30 123 4567"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendPhoneCode}
                      className={styles.codeBtn}
                      disabled={sendingCode || phoneNumber.length < 11}
                    >
                      {sendingCode ? 'Sending...' : verificationId ? 'Resend code' : 'Send code'}
                    </button>
                  </div>
                </Field.Root>
                <p className={styles.helperText}>
                  We use Firebase SMS verification to keep customer accounts trustworthy.
                </p>
                <div id="customer-phone-recaptcha" />
              </li>
            )}

            {requirePhoneVerification && verificationId && (
              <li className={styles.fieldItem}>
                <Field.Root>
                  <Field.Label className={styles.label}>Verification code</Field.Label>
                  <Field.Control
                    render={<Input className={styles.input} />}
                    name="phoneCode"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    required
                  />
                </Field.Root>
                <p className={styles.helperText}>
                  Enter the 6-digit code sent to {codeSentTo || phoneNumber}. Your phone is linked when you create the account.
                </p>
              </li>
            )}

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
                Remember me
              </label>
            </li>

            <li>
              <Button type="submit" className={styles.submitBtn} disabled={loading || !flagsLoaded}>
                {!flagsLoaded ? 'Checking settings...' : loading ? 'Creating account…' : 'Create Account'}
              </Button>
            </li>
          </ol>
        </form>

        <div className={styles.accountPanel}>
          <p className={styles.panelTitle}>Your account gives you</p>
          <ul className={styles.panelList}>
            <li>Saved project details so you can contact more than one pro.</li>
            <li>Private messages and quote updates in your dashboard.</li>
            <li>Appointment tracking and reviews after the job is complete.</li>
          </ul>
        </div>
      </div>

      <div className={styles.footer}>
        Already have an account? <Link href="/login">Log in</Link>.
      </div>
    </div>
    </div>
  )
}

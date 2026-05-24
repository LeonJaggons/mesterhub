'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { onAuthChange } from '@/firebase/auth'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const DEMO_PHONE_VERIFICATION = process.env.NEXT_PUBLIC_ENABLE_DEMO_PHONE_VERIFICATION === 'true'

export default function AccountPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [showOtp, setShowOtp] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpSent, setOtpSent] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    return onAuthChange(user => {
      setCurrentUser(user)
      if (!user) return
      setFullName(user.displayName ?? '')
      setEmail(user.email ?? '')
      setPassword('')
    })
  }, [])

  const usingExistingAccount = Boolean(currentUser)
  const otpComplete = otp.every(d => d !== '')
  const canSend = phone.length >= 9 && fullName && email && (usingExistingAccount || password.length >= 8)
  const canContinue = fullName && email && phone.length >= 9 && (usingExistingAccount || password.length >= 8)
    && (!DEMO_PHONE_VERIFICATION || otpComplete)

  function sendOtp() {
    if (!DEMO_PHONE_VERIFICATION) return
    setOtpSent(true)
    setShowOtp(true)
  }

  function handleOtpChange(i: number, v: string) {
    if (!/^\d?$/.test(v)) return
    const next = [...otp]
    next[i] = v
    setOtp(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const [submitting, setSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  async function handleContinue() {
    setSubmitting(true)
    setAuthError(null)
    try {
      if (currentUser) {
        save({
          fullName: fullName.trim(),
          email: currentUser.email ?? email.trim(),
          phone,
          password: '',
          phoneVerified: DEMO_PHONE_VERIFICATION && otpComplete,
        })
      } else {
        save({ fullName: fullName.trim(), email: email.trim(), phone, password, phoneVerified: DEMO_PHONE_VERIFICATION && otpComplete })
      }
      router.push('/pro/signup/trade')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not save account details.'
      setAuthError(msg.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.stepPage}>
      <h1 className={styles.stepTitle} style={dg}>
        {usingExistingAccount ? 'Confirm your contact details' : 'Create your account'}
      </h1>
      <p className={styles.stepSubtitle}>
        {usingExistingAccount
          ? 'You are already signed in, so we will use this account for your mester profile. Just verify the phone number customers can use to reach you.'
          : 'Your phone number is how customers reach you and how we send job alerts. We verify it now to keep the platform trustworthy.'}
      </p>

      {usingExistingAccount && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '1rem',
          border: '1px solid #fed7aa',
          background: '#fff7ed',
          borderRadius: '0.75rem',
          color: '#9a3412',
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}>
          You&apos;ll become a mester with your existing account. No new login or password is needed.
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Full name</label>
        <input className={styles.input} placeholder="Kovács János" value={fullName} onChange={e => setFullName(e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Email address</label>
        <input
          className={styles.input}
          type="email"
          placeholder="janos@example.hu"
          value={email}
          onChange={e => setEmail(e.target.value)}
          readOnly={usingExistingAccount && Boolean(currentUser?.email)}
          style={usingExistingAccount && currentUser?.email ? { background: '#f9fafb', color: '#6b7280' } : undefined}
        />
      </div>

      {!usingExistingAccount && (
        <div className={styles.field}>
          <label className={styles.label}>Password <span className={styles.labelHint}>min. 8 characters</span></label>
          <input className={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Phone number</label>
        <div className={styles.inputGroup}>
          <input
            className={styles.input}
            style={{ maxWidth: 64 }}
            value="+36"
            readOnly
          />
          <input
            className={styles.input}
            type="tel"
            placeholder="30 123 4567"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          />
          <button
            type="button"
            onClick={sendOtp}
            disabled={!DEMO_PHONE_VERIFICATION || !canSend}
            style={{
              flexShrink: 0, padding: '0 1rem', background: DEMO_PHONE_VERIFICATION && canSend ? '#f97316' : '#e5e7eb',
              color: DEMO_PHONE_VERIFICATION && canSend ? 'white' : '#9ca3af', border: 'none', borderRadius: '0.5rem',
              fontWeight: 700, fontSize: '0.875rem', cursor: DEMO_PHONE_VERIFICATION && canSend ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
          >
            {DEMO_PHONE_VERIFICATION ? (otpSent ? 'Resend' : 'Send code') : 'Verified later'}
          </button>
        </div>
        {!DEMO_PHONE_VERIFICATION && (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Phone verification is completed during profile review. Demo OTP is disabled for launch builds.
          </p>
        )}
      </div>

      {DEMO_PHONE_VERIFICATION && showOtp && (
        <div className={styles.field}>
          <label className={styles.label}>Enter the 6-digit code sent to +36 {phone}</label>
          <div className={styles.otpRow}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el }}
                className={styles.otpInput}
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                inputMode="numeric"
              />
            ))}
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Demo: any 6 digits will work.
          </p>
        </div>
      )}

      {authError && (
        <p style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.5rem' }}>{authError}</p>
      )}

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={!canContinue || submitting}
        onClick={handleContinue}
      >
        {submitting ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}

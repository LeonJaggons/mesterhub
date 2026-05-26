'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { normalizeHungarianPhone, onAuthChange, sendPhoneVerificationCode, signUp, signUpWithVerifiedPhone, verifyCurrentUserPhone } from '@/firebase/auth'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export default function AccountPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [verificationId, setVerificationId] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [codeSentTo, setCodeSentTo] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [flagsLoaded, setFlagsLoaded] = useState(false)
  const [requirePhoneVerification, setRequirePhoneVerification] = useState(false)

  useEffect(() => {
    return onAuthChange(user => {
      setCurrentUser(user)
      if (!user) return
      setFullName(user.displayName ?? '')
      setEmail(user.email ?? '')
      setPhone(user.phoneNumber ?? '')
      setPassword('')
    })
  }, [])

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

  const usingExistingAccount = Boolean(currentUser)
  const normalizedPhone = normalizeHungarianPhone(phone)
  const hasVerifiedPhone = Boolean(currentUser?.phoneNumber)
  const phoneCodeReady = !requirePhoneVerification || hasVerifiedPhone || (Boolean(verificationId) && phoneCode.trim().length === 6)
  const canSend = normalizedPhone.length >= 11 && fullName && email && (usingExistingAccount || password.length >= 8)
  const canContinue = fullName && email && normalizedPhone.length >= 11 && (usingExistingAccount || password.length >= 8) && phoneCodeReady

  const [submitting, setSubmitting] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  async function sendOtp() {
    setAuthError(null)
    setSendingCode(true)
    try {
      const id = await sendPhoneVerificationCode(normalizedPhone, 'pro-phone-recaptcha')
      setVerificationId(id)
      setCodeSentTo(normalizedPhone)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not send verification code.'
      setAuthError(msg.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''))
    } finally {
      setSendingCode(false)
    }
  }

  async function handleContinue() {
    setSubmitting(true)
    setAuthError(null)
    try {
      if (currentUser) {
        if (requirePhoneVerification && !hasVerifiedPhone) {
          await verifyCurrentUserPhone({ verificationId, code: phoneCode })
        }
        save({
          fullName: fullName.trim(),
          email: currentUser.email ?? email.trim(),
          phone: normalizeHungarianPhone(phone),
          password: '',
          phoneVerified: requirePhoneVerification || hasVerifiedPhone,
        })
      } else {
        const user = requirePhoneVerification
          ? await signUpWithVerifiedPhone(
              email.trim(),
              password,
              fullName.trim(),
              '',
              { verificationId, code: phoneCode },
            )
          : await signUp(email.trim(), password, fullName.trim(), '')
        setCurrentUser(user)
        save({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: user.phoneNumber ?? normalizeHungarianPhone(phone),
          password: '',
          phoneVerified: requirePhoneVerification,
        })
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
            type="tel"
            placeholder="+36 30 123 4567"
            value={phone}
            onChange={e => {
              setPhone(e.target.value)
              setVerificationId('')
              setPhoneCode('')
            }}
            readOnly={hasVerifiedPhone}
            style={hasVerifiedPhone ? { background: '#f9fafb', color: '#6b7280' } : undefined}
          />
          <button
            type="button"
            onClick={sendOtp}
            disabled={!requirePhoneVerification || hasVerifiedPhone || sendingCode || !canSend}
            className={styles.inlineBtn}
          >
            {!requirePhoneVerification ? 'Flag off' : hasVerifiedPhone ? 'Verified' : sendingCode ? 'Sending...' : verificationId ? 'Resend code' : 'Send code'}
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: hasVerifiedPhone ? '#15803d' : '#9ca3af', marginTop: '0.5rem' }}>
          {!requirePhoneVerification
            ? 'Phone verification is currently disabled by feature flag. We will save this phone number unverified.'
            : hasVerifiedPhone
            ? 'This phone number is verified on your Firebase account.'
            : 'We send a Firebase SMS code and link this number to your account before you continue.'}
        </p>
        {requirePhoneVerification && <div id="pro-phone-recaptcha" />}
      </div>

      {requirePhoneVerification && !hasVerifiedPhone && verificationId && (
        <div className={styles.field}>
          <label className={styles.label}>Enter the 6-digit code sent to {codeSentTo || normalizedPhone}</label>
          <input
            className={styles.input}
            inputMode="numeric"
            maxLength={6}
            value={phoneCode}
            onChange={e => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
          />
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            We verify the code and attach the number to your Firebase account when you continue.
          </p>
        </div>
      )}

      {authError && (
        <p style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.5rem' }}>{authError}</p>
      )}

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={!flagsLoaded || !canContinue || submitting}
        onClick={handleContinue}
      >
        {!flagsLoaded ? 'Checking settings...' : submitting ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}

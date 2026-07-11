'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { normalizeHungarianPhone, onAuthChange, sendPhoneVerificationCode, signUp, signUpWithVerifiedPhone, verifyCurrentUserPhone } from '@/firebase/auth'
import { useTranslations } from '@/lib/i18n/client'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export default function AccountPage() {
  const t = useTranslations()
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
    const ref = new URLSearchParams(window.location.search).get('ref')?.trim() ?? ''
    if (ref) {
      window.localStorage.setItem('mesterhub_pro_referral_code', ref)
      save({ referralCode: ref })
    } else {
      const storedRef = window.localStorage.getItem('mesterhub_pro_referral_code')
      if (storedRef) save({ referralCode: storedRef })
    }

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
      const msg = err instanceof Error ? err.message : t('proSignup.account.sendCodeError')
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
      const msg = err instanceof Error ? err.message : t('proSignup.account.saveError')
      setAuthError(msg.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.stepPage}>
      <h1 className={styles.stepTitle} style={dg}>
        {usingExistingAccount ? t('proSignup.account.titleExisting') : t('proSignup.account.titleNew')}
      </h1>
      <p className={styles.stepSubtitle}>
        {usingExistingAccount
          ? t('proSignup.account.subtitleExisting')
          : t('proSignup.account.subtitleNew')}
      </p>

      {usingExistingAccount && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '1rem',
          border: '1px solid #bae6fd',
          background: '#f0f9ff',
          borderRadius: '0.75rem',
          color: '#075985',
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}>
          {t('proSignup.account.existingNotice')}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.account.fullName')}</label>
        <input className={styles.input} placeholder="Kovács János" value={fullName} onChange={e => setFullName(e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.account.email')}</label>
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
          <label className={styles.label}>{t('proSignup.account.password')} <span className={styles.labelHint}>{t('proSignup.account.passwordHint')}</span></label>
          <input className={styles.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.account.phone')}</label>
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
            {!requirePhoneVerification ? t('proSignup.account.flagOff') : hasVerifiedPhone ? t('proSignup.account.verified') : sendingCode ? t('proSignup.account.sending') : verificationId ? t('proSignup.account.resendCode') : t('proSignup.account.sendCode')}
          </button>
        </div>
        <p style={{ fontSize: '0.8125rem', color: hasVerifiedPhone ? '#15803d' : '#9ca3af', marginTop: '0.5rem' }}>
          {!requirePhoneVerification
            ? t('proSignup.account.phoneFlagOff')
            : hasVerifiedPhone
            ? t('proSignup.account.phoneVerified')
            : t('proSignup.account.phoneHelper')}
        </p>
        {requirePhoneVerification && <div id="pro-phone-recaptcha" />}
      </div>

      {requirePhoneVerification && !hasVerifiedPhone && verificationId && (
        <div className={styles.field}>
          <label className={styles.label}>{t('proSignup.account.codeLabel', { phone: codeSentTo || normalizedPhone })}</label>
          <input
            className={styles.input}
            inputMode="numeric"
            maxLength={6}
            value={phoneCode}
            onChange={e => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
          />
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            {t('proSignup.account.codeHelper')}
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
        {!flagsLoaded ? t('proSignup.account.checking') : submitting ? t('proSignup.account.saving') : t('proSignup.common.continue')}
      </button>
    </div>
  )
}

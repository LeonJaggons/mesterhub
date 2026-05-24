'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { auth } from '@/firebase/index'
import { onAuthChange } from '@/firebase/auth'
import type { User } from 'firebase/auth'
import styles from './FeedbackFab.module.css'

type FeedbackType = 'problem' | 'feature' | 'general'
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

const hiddenPathPrefixes = [
  '/login',
  '/register',
  '/pro/signup',
]

function FeedbackIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function getViewport() {
  if (typeof window === 'undefined') return ''
  return `${window.innerWidth}x${window.innerHeight}`
}

export default function FeedbackFab() {
  const pathname = usePathname()
  const formTitleId = useId()
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('problem')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const shouldHide = useMemo(
    () => hiddenPathPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/')),
    [pathname],
  )

  useEffect(() => onAuthChange(setUser), [])

  useEffect(() => {
    if (!open) return

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  if (shouldHide) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitState('submitting')
    setStatusMessage('')

    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type,
          message,
          email,
          path: pathname,
          viewport: getViewport(),
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Could not send feedback.')
      }

      setSubmitState('success')
      setStatusMessage('Thanks, got it. This helps us prioritize what to fix next.')
      setMessage('')
      if (!user) setEmail('')
    } catch (err) {
      setSubmitState('error')
      setStatusMessage(err instanceof Error ? err.message : 'Could not send feedback.')
    }
  }

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
        <span className={styles.fabIcon}><FeedbackIcon /></span>
        <span className={styles.fabLabel}>Feedback</span>
      </button>

      {open && (
        <>
          <div className={styles.scrim} onClick={() => setOpen(false)} />
          <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={formTitleId}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>MVP feedback</p>
                <h2 id={formTitleId} className={styles.title}>Report a problem or idea</h2>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Close feedback form">
                <CloseIcon />
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.field}>
                <span className={styles.label}>What is this about?</span>
                <select className={styles.select} value={type} onChange={event => setType(event.target.value as FeedbackType)}>
                  <option value="problem">Report a problem</option>
                  <option value="feature">Request a feature</option>
                  <option value="general">General feedback</option>
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Details</span>
                <textarea
                  className={styles.textarea}
                  value={message}
                  onChange={event => setMessage(event.target.value)}
                  placeholder="Tell us what happened, what you expected, or what would make this better."
                  maxLength={2000}
                  required
                />
              </label>

              {!user && (
                <label className={styles.field}>
                  <span className={styles.label}>Email for follow-up, optional</span>
                  <input
                    className={styles.input}
                    type="email"
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    maxLength={254}
                  />
                </label>
              )}

              <p className={styles.hint}>We include the current page and browser info so you do not have to.</p>

              {statusMessage && (
                <p className={styles.status} data-tone={submitState === 'success' ? 'success' : 'error'}>
                  {statusMessage}
                </p>
              )}

              <div className={styles.actions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)} disabled={submitState === 'submitting'}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={submitState === 'submitting'}>
                  {submitState === 'submitting' ? 'Sending...' : 'Send feedback'}
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </>
  )
}

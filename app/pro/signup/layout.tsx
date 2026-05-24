'use client'

import { useEffect, useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoMark } from '@/app/components/Header'
import styles from './signup.module.css'

const STEPS = [
  '/pro/signup/account',
  '/pro/signup/trade',
  '/pro/signup/area',
  '/pro/signup/profile',
  '/pro/signup/work',
  '/pro/signup/faq',
  '/pro/signup/verification',
  '/pro/signup/credentials',
  '/pro/signup/background',
  '/pro/signup/payout',
  '/pro/signup/complete',
]

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [showExitModal, setShowExitModal] = useState(false)
  const idx = STEPS.indexOf(pathname)
  const progress = idx >= 0 ? ((idx + 1) / STEPS.length) * 100 : 0
  const stepLabel = idx >= 0 ? `Step ${idx + 1} of ${STEPS.length}` : ''
  const shouldWarnBeforeExit = idx >= 0 && pathname !== '/pro/signup/complete'
  const exitWarning = 'Your pro account has not been created yet. If you exit now, your signup progress may be lost.'

  useEffect(() => {
    if (!shouldWarnBeforeExit) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = exitWarning
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [shouldWarnBeforeExit, exitWarning])

  useEffect(() => {
    if (!showExitModal) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowExitModal(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showExitModal])

  function handleExit(event: MouseEvent<HTMLAnchorElement>) {
    if (!shouldWarnBeforeExit) return
    event.preventDefault()
    setShowExitModal(true)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.topBarLogo}>
          <LogoMark />
        </Link>

        <span className={styles.stepCount}>{stepLabel}</span>

        <Link href="/pro" className={styles.exitLink} onClick={handleExit}>Exit</Link>
      </header>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.content}>
        {children}
      </div>

      {showExitModal && (
        <div className={styles.exitModalBackdrop} onClick={() => setShowExitModal(false)}>
          <div
            className={styles.exitModalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-modal-title"
            onClick={event => event.stopPropagation()}
          >
            <h2 id="exit-modal-title" className={styles.exitModalTitle}>Exit signup?</h2>
            <p className={styles.exitModalText}>
              Your pro account hasn&apos;t been created yet. If you exit now, your signup progress may be lost.
            </p>
            <div className={styles.exitModalActions}>
              <button type="button" className={styles.exitModalSecondary} onClick={() => setShowExitModal(false)}>
                Keep going
              </button>
              <Link href="/pro" className={styles.exitModalPrimary}>
                Exit signup
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

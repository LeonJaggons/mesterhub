'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const idx = STEPS.indexOf(pathname)
  const progress = idx >= 0 ? ((idx + 1) / STEPS.length) * 100 : 0
  const stepLabel = idx >= 0 ? `Step ${idx + 1} of ${STEPS.length}` : ''

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.topBarLogo}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
                stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className={styles.topBarLogoText} style={dg}>
            <span style={{ color: '#111827' }}>mester</span>
            <span style={{ color: '#f97316' }}>hub</span>
          </span>
        </Link>

        <span className={styles.stepCount}>{stepLabel}</span>

        <Link href="/pro" className={styles.exitLink}>Exit</Link>
      </header>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>

      <div className={styles.content}>
        {children}
      </div>
    </div>
  )
}

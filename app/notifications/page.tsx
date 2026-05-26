'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { useNotifications } from '@/app/components/notifications/useNotifications'
import { useTranslations } from '@/lib/i18n/client'
import type { User } from 'firebase/auth'
import styles from '../account/account.module.css'

function formatTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export default function NotificationsPage() {
  const router = useRouter()
  const t = useTranslations()
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const notificationsState = useNotifications(Boolean(user))

  useEffect(() => {
    return onAuthChange(currentUser => {
      if (!currentUser) {
        router.replace('/login?next=/notifications')
        return
      }
      setUser(currentUser)
      setAuthReady(true)
    })
  }, [router])

  if (!authReady) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <p className={styles.subtitle}>{t('notificationsPage.loading')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('notificationsPage.title')}</h1>
        <p className={styles.subtitle}>
          {notificationsState.unreadCount
            ? t(notificationsState.unreadCount === 1 ? 'notificationsPage.unreadSingular' : 'notificationsPage.unreadPlural', { count: notificationsState.unreadCount })
            : t('notificationsPage.allCaughtUp')}
        </p>

        <section className={styles.card}>
          {notificationsState.unreadCount > 0 && (
            <button
              type="button"
              className={styles.submitBtn}
              style={{ marginTop: 0, marginBottom: '1rem' }}
              onClick={() => { void notificationsState.markAllRead() }}
            >
              {t('notificationsPage.markAllRead')}
            </button>
          )}

          {notificationsState.notifications.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {notificationsState.notifications.map(notification => (
                <Link
                  key={notification.id}
                  href={notification.href}
                  onClick={() => {
                    if (!notification.readAt) void notificationsState.markRead(notification.id)
                  }}
                  style={{
                    display: 'block',
                    border: '1px solid var(--color-gray-200)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    textDecoration: 'none',
                    background: notification.readAt ? '#fff' : '#f8fafc',
                    color: 'inherit',
                  }}
                >
                  <span style={{ display: 'block', fontWeight: 800, color: '#111827' }}>{notification.title}</span>
                  <span style={{ display: 'block', marginTop: '0.25rem', color: '#4b5563', lineHeight: 1.5 }}>{notification.body}</span>
                  <span style={{ display: 'block', marginTop: '0.5rem', color: '#9ca3af', fontSize: '0.8125rem' }}>
                    {formatTime(notification.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>{notificationsState.loading ? t('notificationsPage.emptyLoading') : t('notificationsPage.emptyTitle')}</p>
              <p>{t('notificationsPage.emptyBody')}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import type { Conversation } from '@/firebase/conversations'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
import { timestampMillis } from '@/app/requests/shared'
import MessageAvatar from './MessageAvatar'
import {
  formatListTime,
  partnerDisplayName,
  type MessageRole,
} from './utils'
import styles from './messages.module.css'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type ConversationRow = Conversation & { id: string; proAvatarUrl?: string | null }

type Props = {
  role: MessageRole
  filterField: 'customerUid' | 'proUid'
  basePath: string
  loginNext: string
  subtitle: string
  emptyTitle: string
  emptyBody: string
  emptyCta: { href: string; label: string }
}

export default function ConversationList({
  basePath,
  loginNext,
  subtitle,
  emptyTitle,
  emptyBody,
  emptyCta,
  role,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(loginNext)}`)
        return
      }
      try {
        const response = await authenticatedFetch(`/api/conversations?role=${role}`)
        const data = (await response.json()) as { conversations?: ConversationRow[] }
        const rows = (data.conversations ?? [])
          .filter(row => role !== 'customer' || !('customerDeletedAt' in row))
          .sort((a, b) => (timestampMillis(b.lastMessageAt) ?? 0) - (timestampMillis(a.lastMessageAt) ?? 0))
        setConversations(rows)
      } catch {
        setConversations([])
      } finally {
        setLoading(false)
      }
    })
  }, [router, loginNext, role])

  const visibleConversations = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter(c => {
      const haystack = [
        partnerDisplayName(c, role, t('messages.thread.customerFallback')),
        c.categoryName,
        c.lastMessage,
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [conversations, role, search, t])

  const roleLabel = role === 'customer' ? t('messages.list.customerInbox') : t('messages.list.proInbox')
  const helperTitle = role === 'customer'
    ? t('messages.list.customerHelperTitle')
    : t('messages.list.proHelperTitle')
  const helperItems = role === 'customer'
    ? [
        t('messages.list.customerTipQuote'),
        t('messages.list.customerTipAccess'),
        t('messages.list.customerTipScope'),
      ]
    : [
        t('messages.list.proTipStart'),
        t('messages.list.proTipCosts'),
        t('messages.list.proTipBrief'),
      ]

  return (
    <div className={styles.shell}>
      <div className={styles.listLayout}>
        <section className={styles.inboxPane}>
          <header className={styles.listHeader}>
            <p className={styles.listEyebrow}>{roleLabel}</p>
            <h1 className={styles.listTitle}>{t('messages.list.title')}</h1>
            <p className={styles.listSubtitle}>{subtitle}</p>
            <label className={styles.searchWrap}>
              <span className={styles.searchIcon}>{t('messages.list.searchLabel')}</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('messages.list.searchPlaceholder')}
                className={styles.searchInput}
              />
            </label>
          </header>

          <div className={styles.listScroll}>
            {loading ? (
              <>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </>
            ) : conversations.length === 0 ? (
              <div className={styles.centered}>
                <p className={styles.centeredTitle}>{emptyTitle}</p>
                <p className={styles.centeredText}>{emptyBody}</p>
                <Link href={emptyCta.href} className={styles.ctaBtn}>
                  {emptyCta.label}
                </Link>
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className={styles.centered}>
                <p className={styles.centeredTitle}>{t('messages.list.noResultsTitle')}</p>
                <p className={styles.centeredText}>{t('messages.list.noResultsBody')}</p>
              </div>
            ) : (
              <ul className={styles.listRows}>
                {visibleConversations.map(c => {
                  const name = partnerDisplayName(c, role, t('messages.thread.customerFallback'))
                  return (
                    <li key={c.id} className={styles.listRow}>
                      <Link href={`${basePath}/${c.id}`} className={styles.listLink}>
                        <MessageAvatar name={name} imageUrl={role === 'customer' ? c.proAvatarUrl : null} />
                        <div className={styles.listBody}>
                          <div className={styles.listNameRow}>
                            <p className={styles.listName}>{name}</p>
                            <span className={styles.listTime}>{formatListTime(c.lastMessageAt, locale, t)}</span>
                          </div>
                          <p className={styles.listPreview}>{c.lastMessage}</p>
                          <span className={styles.listCategory}>{translateCategory(t, c.categoryName)}</span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        <aside className={styles.inboxAside}>
          {role === 'pro' && <ProUpgradeCta className="mb-4" />}
          <div className={styles.asideCard}>
            <p className={styles.asideKicker}>{t('messages.list.asideKicker')}</p>
            <h2 className={styles.asideTitle}>{helperTitle}</h2>
            <ul className={styles.tipList}>
              {helperItems.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

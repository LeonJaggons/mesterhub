'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, doc, query, where, getDoc, getDocs } from 'firebase/firestore'
import { db } from '@/firebase/index'
import { onAuthChange } from '@/firebase/auth'
import type { Conversation } from '@/firebase/conversations'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
import MessageAvatar from './MessageAvatar'
import {
  formatListTime,
  partnerDisplayName,
  type MessageRole,
} from './utils'
import styles from './messages.module.css'

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
  filterField,
  basePath,
  loginNext,
  subtitle,
  emptyTitle,
  emptyBody,
  emptyCta,
  role,
}: Props) {
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
        const snap = await getDocs(
          query(collection(db, 'conversations'), where(filterField, '==', user.uid))
        )
        const rows = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ConversationRow))
          .filter(row => role !== 'customer' || !('customerDeletedAt' in row))
          .sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0))
        if (role === 'customer') {
          const proUids = [...new Set(rows.map(row => row.proUid).filter(Boolean))]
          const proSnaps = await Promise.all(proUids.map(uid => getDoc(doc(db, 'pros', uid))))
          const avatarMap = new Map(
            proSnaps
              .filter(proSnap => proSnap.exists())
              .map(proSnap => [proSnap.id, (proSnap.data().avatarUrl as string | null) ?? null]),
          )
          setConversations(rows.map(row => ({ ...row, proAvatarUrl: avatarMap.get(row.proUid) ?? null })))
        } else {
          setConversations(rows)
        }
      } catch {
        setConversations([])
      } finally {
        setLoading(false)
      }
    })
  }, [router, filterField, loginNext, role])

  const visibleConversations = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter(c => {
      const haystack = [
        partnerDisplayName(c, role),
        c.categoryName,
        c.lastMessage,
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [conversations, role, search])

  const roleLabel = role === 'customer' ? 'Customer inbox' : 'Pro inbox'
  const helperTitle = role === 'customer'
    ? 'Before you message the pro'
    : 'Before you message the customer'
  const helperItems = role === 'customer'
    ? [
        'Confirm what is included in the quote before work starts.',
        'Share timing, access, parking, pets, and anything fragile nearby.',
        'Keep scope changes in the conversation so both sides have the same record.',
      ]
    : [
        'Confirm the start window, exact access details, and any prep needed.',
        'Call out materials, parking, or extra costs before arriving.',
        'Use the job page if you need the full project brief while replying.',
      ]

  return (
    <div className={styles.shell}>
      <div className={styles.listLayout}>
        <section className={styles.inboxPane}>
          <header className={styles.listHeader}>
            <p className={styles.listEyebrow}>{roleLabel}</p>
            <h1 className={styles.listTitle}>Messages</h1>
            <p className={styles.listSubtitle}>{subtitle}</p>
            <label className={styles.searchWrap}>
              <span className={styles.searchIcon}>Search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search people, jobs, or messages"
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
                <p className={styles.centeredTitle}>No conversations found</p>
                <p className={styles.centeredText}>Try a customer, pro, service, or message keyword.</p>
              </div>
            ) : (
              <ul className={styles.listRows}>
                {visibleConversations.map(c => {
                  const name = partnerDisplayName(c, role)
                  return (
                    <li key={c.id} className={styles.listRow}>
                      <Link href={`${basePath}/${c.id}`} className={styles.listLink}>
                        <MessageAvatar name={name} imageUrl={role === 'customer' ? c.proAvatarUrl : null} />
                        <div className={styles.listBody}>
                          <div className={styles.listNameRow}>
                            <p className={styles.listName}>{name}</p>
                            <span className={styles.listTime}>{formatListTime(c.lastMessageAt)}</span>
                          </div>
                          <p className={styles.listPreview}>{c.lastMessage}</p>
                          <span className={styles.listCategory}>{c.categoryName}</span>
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
            <p className={styles.asideKicker}>Message smarter</p>
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

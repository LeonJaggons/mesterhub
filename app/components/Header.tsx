'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@base-ui/react/button'
import { onAuthChange, signOut } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { defaultLocale, getPathLocale, getPathnameWithoutLocale, locales, localizeHref, type Locale } from '@/lib/i18n/config'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory, translateService } from '@/lib/i18n/taxonomy'
import { useNotifications, type ClientNotification } from './notifications/useNotifications'
import type { User } from 'firebase/auth'
import styles from './Header.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { name: string; total_services: number; featured: string[] }
type CategoryDetail = Category & { services: string[] }
type ProBasic = { uid: string; fullName: string; categoryName: string }
type NotificationsState = ReturnType<typeof useNotifications>

const LANGUAGE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  hu: { short: 'HU', name: 'Magyar' },
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function LogoMark() {
  return (
    <span className={styles.logoMark}>
      <span className={styles.logoIcon} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="15" height="15" focusable="false">
          <path fill="#FFF" d="M8.973 10.385a3.71 3.71 0 01-.564 1.957L8 13l-.409-.658a3.704 3.704 0 01-.564-1.957v-3.14C7.51 6.62 8.231 6.4 8.973 6.4v3.985zM4 5.69V4h8v1.69H4z" />
        </svg>
      </span>
      <span className={`${styles.logoText} select-none`}>
        <span className="text-gray-900">mester</span><span className="text-orange-500">mind</span>
      </span>
    </span>
  )
}

function ChevronDown() {
  return (
    <svg height="20" width="20" fill="currentColor" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.354 10.764L14 19l7.689-8.275a1 1 0 00-1.342-1.482L14 16 7.715 9.301A1.026 1.026 0 007 9a1 1 0 00-1 1c0 .306.151.537.354.764z" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg height="28" width="28" fill="currentColor" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.764 21.646L19 14l-8.275-7.689a1 1 0 00-1.482 1.342L16 14l-6.699 6.285c-.187.2-.301.435-.301.715a1 1 0 001 1c.306 0 .537-.151.764-.354z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 010 20" />
      <path d="M12 2a15.3 15.3 0 000 20" />
    </svg>
  )
}

function getInitials(user: User): string {
  if (user.displayName) return user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return user.email?.[0].toUpperCase() ?? '?'
}

function AvatarImg({ user }: { user: User }) {
  const t = useTranslations()
  if (user.photoURL) return <img src={user.photoURL} alt={user.displayName ?? t('header.proNav.profile')} className={styles.avatarImg} />
  return <span>{getInitials(user)}</span>
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [ref, onClose, enabled])
}

function LanguageChooser({ compact = false }: { compact?: boolean }) {
  const t = useTranslations()
  const rawPathname = usePathname()
  const locale = getPathLocale(rawPathname) ?? defaultLocale
  const pathname = getPathnameWithoutLocale(rawPathname)
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  const queryString = searchParams.toString()
  const href = queryString ? `${pathname}?${queryString}` : pathname

  async function chooseLocale(event: React.MouseEvent<HTMLAnchorElement>, nextLocale: Locale) {
    event.preventDefault()
    const nextHref = localizeHref(href, nextLocale)
    setOpen(false)

    try {
      await authenticatedFetch('/api/me/locale', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLocale: nextLocale }),
      })
    } catch {
      // Signed-out visitors still get the locale cookie from the localized route.
    } finally {
      window.location.assign(nextHref)
    }
  }

  return (
    <div ref={ref} className={compact ? styles.languageAnchorMobile : styles.languageAnchor}>
      <button
        type="button"
        className={styles.languageButton}
        onClick={() => setOpen(value => !value)}
        aria-label={t('header.aria.changeLanguage')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <GlobeIcon />
        <span className={styles.languageButtonLabel}>{LANGUAGE_LABELS[locale].short}</span>
      </button>
      <div className={styles.languagePopover} data-open={open ? '' : undefined} role="menu">
        {locales.map(nextLocale => (
          <a
            key={nextLocale}
            href={localizeHref(href, nextLocale)}
            hrefLang={nextLocale}
            role="menuitem"
            aria-current={locale === nextLocale ? 'true' : undefined}
            className={`${styles.languageOption} ${locale === nextLocale ? styles.languageOptionActive : ''}`}
            onClick={event => chooseLocale(event, nextLocale)}
          >
            <span className={styles.languageOptionName}>{LANGUAGE_LABELS[nextLocale].name}</span>
            <span className={styles.languageOptionCode}>{LANGUAGE_LABELS[nextLocale].short}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Customer nav ─────────────────────────────────────────────────────────────

function ServicesDropdown({ categories }: { categories: Category[] }) {
  const t = useTranslations()
  const [active, setActive] = useState<string | null>(null)
  const [detail, setDetail] = useState<CategoryDetail | null>(null)
  const activeCategory = active ?? categories[0]?.name ?? null

  useEffect(() => {
    if (!activeCategory) return
    fetch(`/api/categories?name=${encodeURIComponent(activeCategory)}`).then(r => r.json()).then(setDetail)
  }, [activeCategory])

  return (
    <div className={styles.DropdownLayout}>
      <div className={styles.CategoryPanel}>
        <div className={styles.DropdownHeader}>
          <p className={styles.DropdownKicker}>{t('header.services.kicker')}</p>
          <p className={styles.DropdownTitle}>{t('header.services.title')}</p>
        </div>
        {categories.map((cat, i) => (
          <div key={cat.name}>
            {i > 0 && <hr className={styles.Divider} />}
            <button
              className={`${styles.CategoryItem} ${activeCategory === cat.name ? styles.CategoryItemActive : ''}`}
              onMouseEnter={() => setActive(cat.name)}
              onClick={() => setActive(cat.name)}
            >
              <span className={styles.CategoryItemText}>
                <span>{translateCategory(t, cat.name)}</span>
                <small>{t('header.services.serviceCount', { count: cat.total_services })}</small>
              </span>
              <span className={styles.CategoryItemChevron}><ChevronRight /></span>
            </button>
          </div>
        ))}
      </div>
      <div className={styles.ServicesPanel}>
        <div className={styles.ServicesHeader}>
          <p className={styles.DropdownKicker}>{activeCategory ? translateCategory(t, activeCategory) : t('header.services.fallbackTitle')}</p>
          <p className={styles.ServicesHint}>{t('header.services.hint')}</p>
        </div>
        <div className={styles.ServicesGrid}>
          {detail?.services.map(service => (
            <Link key={service} href={`/instant-results?q=${encodeURIComponent(service)}`} className={styles.ServiceLink}>
              {translateService(t, service)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function ServicesMenu({ categories }: { categories: Category[] }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div
      ref={ref}
      className={styles.servicesAnchor}
      onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true) }}
      onMouseLeave={() => { closeTimer.current = setTimeout(() => setOpen(false), 100) }}
    >
      <button
        className={`${styles.headerMenuText} ${styles.headerNavItem} flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 font-normal text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors`}
        aria-expanded={open}
      >
        {t('header.services.explore')}
        <ChevronDown />
      </button>
      <div className={styles.servicesPopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <ServicesDropdown categories={categories} />
      </div>
    </div>
  )
}

function CustomerNavLink({ href, label, badge = 0 }: { href: string; label: string; badge?: number }) {
  const pathname = getPathnameWithoutLocale(usePathname())
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`${styles.headerMenuText} ${styles.headerNavItem} relative flex items-center gap-1 px-2.5 py-1.5 font-normal rounded-lg transition-colors ${
        active ? 'text-slate-800 bg-slate-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      <NavBadge count={badge} />
    </Link>
  )
}

function CustomerNav({ activeAppointments }: { activeAppointments: number }) {
  const t = useTranslations()

  return (
    <>
      <CustomerNavLink href="/requests" label={t('header.customerNav.requests')} />
      <CustomerNavLink href="/projects" label={t('header.customerNav.projects')} />
      <CustomerNavLink href="/appointments" label={t('header.customerNav.appointments')} badge={activeAppointments} />
      <CustomerNavLink href="/messages" label={t('header.customerNav.messages')} />
    </>
  )
}

function CustomerProfileMenu({ user }: { user: User }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useClickOutside(ref, () => setOpen(false), open)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/')
  }

  return (
    <div ref={ref} className={styles.profileAnchor}>
      <button className={styles.avatar} onClick={() => setOpen(v => !v)} aria-label={t('header.aria.accountMenu')}>
        <AvatarImg user={user} />
      </button>
      <div className={styles.profilePopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.menuUserInfo}>
          <div className={styles.menuUserName}>{user.displayName ?? t('header.auth.account')}</div>
          <div className={styles.menuUserEmail}>{user.email}</div>
        </div>
        <hr className={styles.menuSeparator} />
        <Link href="/settings" className={styles.menuItem} onClick={() => setOpen(false)}>
          {t('header.customerNav.settings')}
        </Link>
        <Link href="/help" className={styles.menuItem} onClick={() => setOpen(false)}>
          {t('header.auth.help')}
        </Link>
        <hr className={styles.menuSeparator} />
        <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleSignOut}>
          {t('header.auth.signOut')}
        </button>
      </div>
    </div>
  )
}

// ─── Pro nav ──────────────────────────────────────────────────────────────────

function NavBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className={styles.navBadge}>{count > 9 ? '9+' : count}</span>
  )
}

function ProNavLink({ href, label, badge = 0 }: { href: string; label: string; badge?: number }) {
  const pathname = getPathnameWithoutLocale(usePathname())
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`${styles.headerMenuText} ${styles.headerNavItem} relative flex items-center gap-1 px-2.5 py-1.5 font-normal rounded-lg transition-colors ${
        active ? 'text-slate-800 bg-slate-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      <NavBadge count={badge} />
    </Link>
  )
}

function notificationTime(value: string | null): string {
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

function BellButton({
  notifications,
  unreadCount,
  loading,
  markRead,
  markAllRead,
}: {
  notifications: ClientNotification[]
  unreadCount: number
  loading: boolean
  markRead: NotificationsState['markRead']
  markAllRead: NotificationsState['markAllRead']
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false), open)

  return (
    <div ref={ref} className={styles.notificationAnchor}>
      <button
        type="button"
        className={styles.notificationButton}
        onClick={() => setOpen(value => !value)}
        aria-label={t('header.aria.notifications')}
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        <NavBadge count={unreadCount} />
      </button>
      <div className={styles.notificationPopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.notificationHeader}>
          <div>
            <p className={styles.notificationKicker}>{t('header.notifications.kicker')}</p>
            <h2 className={styles.notificationTitle}>
              {unreadCount ? t('header.notifications.unread', { count: unreadCount }) : t('header.notifications.allCaughtUp')}
            </h2>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              className={styles.notificationReadAll}
              onClick={() => { void markAllRead() }}
            >
              {t('header.notifications.markAllRead')}
            </button>
          )}
        </div>
        <div className={styles.notificationList}>
          {notifications.length > 0 ? notifications.map(notification => (
            <Link
              key={notification.id}
              href={notification.href}
              className={`${styles.notificationItem} ${notification.readAt ? '' : styles.notificationItemUnread}`}
              onClick={() => {
                setOpen(false)
                if (!notification.readAt) void markRead(notification.id)
              }}
            >
              <span className={styles.notificationItemTitle}>{notification.title}</span>
              <span className={styles.notificationItemBody}>{notification.body}</span>
              <span className={styles.notificationItemTime}>{notificationTime(notification.createdAt)}</span>
            </Link>
          )) : (
            <div className={styles.notificationEmpty}>
              {loading ? t('header.notifications.loading') : t('header.notifications.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProAccountMenu({ user, pro }: { user: User; pro: ProBasic }) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useClickOutside(ref, () => setOpen(false), open)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/')
  }

  return (
    <div ref={ref} className={styles.profileAnchor}>
      <button className={styles.avatar} onClick={() => setOpen(v => !v)} aria-label={t('header.aria.accountMenu')}>
        <AvatarImg user={user} />
      </button>
      <div className={styles.profilePopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.menuUserInfo}>
          <div className={styles.menuUserName}>{user.displayName ?? pro.fullName}</div>
          <div className={styles.menuUserEmail}>{user.email}</div>
        </div>
        <hr className={styles.menuSeparator} />
        <Link href={`/pro/${pro.uid}`} className={styles.menuItem} onClick={() => setOpen(false)}>
          {t('header.proNav.previewProfile')}
        </Link>
        <hr className={styles.menuSeparator} />
        <Link href="/pro/settings" className={styles.menuItem} onClick={() => setOpen(false)}>{t('header.proNav.settings')}</Link>
        <Link href="/pro/verification" className={styles.menuItem} onClick={() => setOpen(false)}>{t('header.proNav.verification')}</Link>
        <Link href="/pro/help" className={styles.menuItem} onClick={() => setOpen(false)}>{t('header.proNav.help')}</Link>
        <hr className={styles.menuSeparator} />
        <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleSignOut}>{t('header.auth.signOut')}</button>
      </div>
    </div>
  )
}

function ProHeaderUpgradeButton() {
  const t = useTranslations()
  const [visible, setVisible] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)

  useEffect(() => {
    let active = true
    authenticatedFetch('/api/pro/profile')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const status = data.account?.subscriptionStatus ?? data.profile?.subscriptionStatus ?? 'inactive'
        setVisible(status !== 'active')
      })
      .catch(() => {
        if (active) setVisible(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (!visible) return null

  async function openCheckout() {
    setBillingLoading(true)
    try {
      const res = await authenticatedFetch('/api/stripe/checkout', { method: 'POST' })
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('Stripe did not return a checkout URL.')
      window.location.href = data.url
    } catch {
      setBillingLoading(false)
    }
  }

  return (
    <button type="button" className={styles.headerUpgradeButton} disabled={billingLoading} onClick={openCheckout}>
      <svg className={styles.headerUpgradeIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M8 1.5l1.35 3.8 3.65 1.28-3.65 1.28L8 11.66 6.65 7.86 3 6.58 6.65 5.3 8 1.5z" />
        <path d="M12.6 10.3l.55 1.55 1.45.5-1.45.5-.55 1.55-.55-1.55-1.45-.5 1.45-.5.55-1.55z" />
      </svg>
      {billingLoading ? t('header.upgrade.opening') : t('header.upgrade.label')}
    </button>
  )
}

function ProNav({
  user,
  pro,
  pendingJobs,
  confirmedAppointments,
  notifications,
}: {
  user: User
  pro: ProBasic
  pendingJobs: number
  confirmedAppointments: number
  notifications: NotificationsState
}) {
  const t = useTranslations()

  return (
    <nav className="flex items-center gap-2">
      <ProNavLink href="/pro/jobs" label={t('header.proNav.jobs')} badge={pendingJobs} />
      <ProNavLink href="/pro/marketplace" label={t('header.proNav.marketplace')} />
      <ProNavLink href="/pro/work" label={t('header.proNav.work')} badge={confirmedAppointments} />
      <ProNavLink href="/pro/messages" label={t('header.proNav.messages')} />
      <ProNavLink href="/pro/earnings" label={t('header.proNav.earnings')} />
      <ProNavLink href={`/pro/${pro.uid}`} label={t('header.proNav.profile')} />
      <ProHeaderUpgradeButton />
      <LanguageChooser />
      <BellButton {...notifications} />
      <div className="ml-1">
        <ProAccountMenu user={user} pro={pro} />
      </div>
    </nav>
  )
}

function MobileNavLink({ href, label, badge = 0, onClick }: { href: string; label: string; badge?: number; onClick: () => void }) {
  const pathname = getPathnameWithoutLocale(usePathname())
  const active = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link href={href} onClick={onClick} className={`${styles.mobileMenuItem} ${active ? styles.mobileMenuItemActive : ''}`}>
      <span>{label}</span>
      <NavBadge count={badge} />
    </Link>
  )
}

function MobileMenu({
  user,
  pro,
  pendingJobs,
  confirmedAppointments,
  activeAppointments,
  unreadNotifications,
}: {
  user: User | null
  pro: ProBasic | null
  pendingJobs: number
  confirmedAppointments: number
  activeAppointments: number
  unreadNotifications: number
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  useClickOutside(ref, () => setOpen(false), open)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    router.push('/')
  }

  return (
    <div ref={ref} className={styles.mobileMenuAnchor}>
      <button
        type="button"
        className={styles.mobileMenuButton}
        onClick={() => setOpen(value => !value)}
        aria-label={t('header.aria.openNavigationMenu')}
        aria-expanded={open}
      >
        <MenuIcon />
      </button>

      <div className={styles.mobileMenuPanel} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.mobileMenuSection}>
          {pro && user ? (
            <>
              <MobileNavLink href="/pro/jobs" label={t('header.proNav.jobs')} badge={pendingJobs} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/marketplace" label={t('header.proNav.marketplace')} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/work" label={t('header.proNav.work')} badge={confirmedAppointments} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/messages" label={t('header.proNav.messages')} onClick={() => setOpen(false)} />
              <MobileNavLink href="/notifications" label={t('header.proNav.notifications')} badge={unreadNotifications} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/earnings" label={t('header.proNav.earnings')} onClick={() => setOpen(false)} />
              <MobileNavLink href={`/pro/${pro.uid}`} label={t('header.proNav.profile')} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/settings" label={t('header.proNav.settings')} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/help" label={t('header.proNav.help')} onClick={() => setOpen(false)} />
            </>
          ) : (
            <>
              <MobileNavLink href="/instant-results" label={t('header.services.explore')} onClick={() => setOpen(false)} />
              {user && (
                <>
                  <MobileNavLink href="/requests" label={t('header.customerNav.requests')} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/projects" label={t('header.customerNav.projects')} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/appointments" label={t('header.customerNav.appointments')} badge={activeAppointments} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/messages" label={t('header.customerNav.messages')} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/notifications" label={t('header.proNav.notifications')} badge={unreadNotifications} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/settings" label={t('header.customerNav.settings')} onClick={() => setOpen(false)} />
                </>
              )}
              <MobileNavLink href="/pro" label={t('header.customerNav.joinPro')} onClick={() => setOpen(false)} />
              {!user && (
                <>
                  <MobileNavLink href="/register" label={t('header.auth.signUp')} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/login" label={t('header.auth.login')} onClick={() => setOpen(false)} />
                </>
              )}
            </>
          )}
        </div>

        {user && (
          <div className={styles.mobileMenuFooter}>
            <div className={styles.mobileUserInfo}>
              <span>{user.displayName ?? t('header.auth.account')}</span>
              <small>{user.email}</small>
            </div>
            <button type="button" className={styles.mobileSignOutButton} onClick={handleSignOut}>
              {t('header.auth.signOut')}
            </button>
          </div>
        )}
        <LanguageChooser compact />
      </div>
    </div>
  )
}

// ─── Root header ──────────────────────────────────────────────────────────────

export default function Header() {
  const t = useTranslations()
  const rawPathname = usePathname()
  const currentLocale = getPathLocale(rawPathname) ?? defaultLocale
  const pathname = getPathnameWithoutLocale(rawPathname)
  const searchParams = useSearchParams()
  const latestRoute = useRef({ currentLocale, pathname, queryString: searchParams.toString() })
  const isSignupPath = pathname.startsWith('/pro/signup')
  const [user, setUser] = useState<User | null>(null)
  const [pro, setPro] = useState<ProBasic | null>(null)
  const [resolvingAccount, setResolvingAccount] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingJobs, setPendingJobs] = useState(0)
  const [confirmedProAppointments, setConfirmedProAppointments] = useState(0)
  const [activeAppointments, setActiveAppointments] = useState(0)
  const notifications = useNotifications(!isSignupPath && Boolean(user))

  latestRoute.current = { currentLocale, pathname, queryString: searchParams.toString() }

  // Detect auth + pro status through the shared API so every client sees the same account resolution.
  useEffect(() => {
    if (isSignupPath) return
    let cancelled = false
    const unsub = onAuthChange(async u => {
      if (!cancelled) setResolvingAccount(true)
      setUser(u)
      if (!u) {
        if (!cancelled) {
          setPro(null)
          setPendingJobs(0)
          setConfirmedProAppointments(0)
          setActiveAppointments(0)
          setResolvingAccount(false)
        }
        return
      }
      const uid = u.uid
      if (!cancelled) setActiveAppointments(0)
      try {
        const res = await authenticatedFetch('/api/me')
        const data = (await res.json()) as { pro: ProBasic | null; preferredLocale?: Locale | null }
        const profile = data.pro
        if (!cancelled && u.uid === uid) {
          setPro(profile)
          const route = latestRoute.current
          if (data.preferredLocale && data.preferredLocale !== route.currentLocale) {
            const { pathname, queryString } = route
            const href = queryString ? `${pathname}?${queryString}` : pathname
            window.location.replace(localizeHref(href, data.preferredLocale))
          }
          if (!profile) {
            setPendingJobs(0)
            setConfirmedProAppointments(0)
          }
        }
      } catch {
        if (!cancelled) setPro(null)
      } finally {
        if (!cancelled) setResolvingAccount(false)
      }
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [isSignupPath])

  // Fetch pending job count for the badge
  useEffect(() => {
    if (isSignupPath || !pro) return
    let cancelled = false
    authenticatedFetch('/api/pro/service-requests')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        const requests = Array.isArray(data.requests) ? data.requests as Array<{ status?: string }> : []
        setPendingJobs(requests.filter(request => request.status === 'pending').length)
      })
      .catch(() => setPendingJobs(0))
    return () => {
      cancelled = true
    }
  }, [isSignupPath, pro])

  // Fetch confirmed pro appointment count for the My Work badge
  useEffect(() => {
    if (isSignupPath || !pro) return
    let cancelled = false
    authenticatedFetch('/api/pro/service-requests')
      .then(res => res.json())
      .then(data => {
        const requests = Array.isArray(data.requests)
          ? data.requests as Array<{ status?: string; appointmentRequest?: { status?: string } }>
          : []
        const count = requests.filter(request => request.status === 'accepted' && request.appointmentRequest?.status === 'confirmed').length
        if (!cancelled) setConfirmedProAppointments(count)
      })
      .catch(() => {
        if (!cancelled) setConfirmedProAppointments(0)
      })
    return () => {
      cancelled = true
    }
  }, [isSignupPath, pro])

  // Fetch active customer appointment count for the badge
  useEffect(() => {
    if (isSignupPath || resolvingAccount || !user || pro) return
    let cancelled = false
    authenticatedFetch('/api/service-requests')
      .then(res => res.json())
      .then(data => {
        const requests = Array.isArray(data.requests)
          ? data.requests as Array<{ status?: string; appointmentRequest?: { status?: string } }>
          : []
        const count = requests.filter(request => request.status === 'accepted' && request.appointmentRequest?.status === 'confirmed').length
        if (!cancelled) setActiveAppointments(count)
      })
      .catch(() => {
        if (!cancelled) setActiveAppointments(0)
      })
    return () => {
      cancelled = true
    }
  }, [isSignupPath, pro, resolvingAccount, user])

  // Only fetch customer categories when NOT a pro
  useEffect(() => {
    if (isSignupPath || resolvingAccount || pro) return
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories)).catch(() => {})
  }, [isSignupPath, pro, resolvingAccount])

  if (isSignupPath) return null

  return (
    <header className={styles.headerRoot}>
      <div className={styles.headerLogoSlot}>
        <Link href={pro ? '/pro/jobs' : '/'} aria-label={t('header.aria.home')} className={styles.logoLink}>
          <LogoMark />
        </Link>
      </div>

      {resolvingAccount ? (
        <nav className={styles.desktopNav} aria-busy="true" aria-label={t('header.aria.loadingAccountNavigation')}>
          <div className={styles.loadingNav} />
        </nav>
      ) : pro && user ? (
        <div className={styles.desktopNav}>
          <ProNav
            user={user}
            pro={pro}
            pendingJobs={pendingJobs}
            confirmedAppointments={confirmedProAppointments}
            notifications={notifications}
          />
        </div>
      ) : (
        <nav className={styles.desktopNav}>
          <ServicesMenu categories={categories} />
          {user && <CustomerNav activeAppointments={activeAppointments} />}
          <Link href="/pro" className={`${styles.headerMenuText} ${styles.headerNavItem} px-2.5 py-1.5 font-normal text-gray-600 hover:text-gray-900 transition-colors`}>
            {t('header.customerNav.joinPro')}
          </Link>
          <LanguageChooser />
          {user ? (
            <>
              <BellButton {...notifications} />
              <div className="ml-1">
                <CustomerProfileMenu user={user} />
              </div>
            </>
          ) : (
            <>
              <Link href="/register">
                <Button className={`${styles.headerMenuText} rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-5 py-2 font-semibold text-white cursor-pointer shadow-sm transition-all`}>
                  {t('header.auth.signUp')}
                </Button>
              </Link>
              <Link href="/login" className={`${styles.headerMenuText} ${styles.headerNavItem} px-3 py-1.5 font-normal text-gray-700 hover:bg-gray-100 rounded-lg transition-colors`}>
                {t('header.auth.login')}
              </Link>
            </>
          )}
        </nav>
      )}
      {!resolvingAccount && (
        <MobileMenu
          user={user}
          pro={pro}
          pendingJobs={pendingJobs}
          confirmedAppointments={confirmedProAppointments}
          activeAppointments={activeAppointments}
          unreadNotifications={notifications.unreadCount}
        />
      )}
    </header>
  )
}

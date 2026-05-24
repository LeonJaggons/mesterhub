'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@base-ui/react/button'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { onAuthChange, signOut } from '@/firebase/auth'
import { db } from '@/firebase/index'
import { resolveProClient } from '@/firebase/resolveProClient'
import type { User } from 'firebase/auth'
import styles from './Header.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { name: string; total_services: number; featured: string[] }
type CategoryDetail = Category & { services: string[] }
type ProBasic = { uid: string; fullName: string; categoryName: string }

// ─── Shared helpers ───────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <span className={styles.logoMark}>
      <span className={styles.logoIcon} aria-hidden="true">
        <svg viewBox="0 0 16 16" width="18" height="18" focusable="false">
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

function getInitials(user: User): string {
  if (user.displayName) return user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  return user.email?.[0].toUpperCase() ?? '?'
}

function AvatarImg({ user }: { user: User }) {
  if (user.photoURL) return <img src={user.photoURL} alt={user.displayName ?? 'Profile'} className={styles.avatarImg} />
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

// ─── Customer nav ─────────────────────────────────────────────────────────────

function ServicesDropdown({ categories }: { categories: Category[] }) {
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
          <p className={styles.DropdownKicker}>Explore services</p>
          <p className={styles.DropdownTitle}>Find the right pro</p>
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
                <span>{cat.name}</span>
                <small>{cat.total_services} services</small>
              </span>
              <span className={styles.CategoryItemChevron}><ChevronRight /></span>
            </button>
          </div>
        ))}
      </div>
      <div className={styles.ServicesPanel}>
        <div className={styles.ServicesHeader}>
          <p className={styles.DropdownKicker}>{activeCategory ?? 'Services'}</p>
          <p className={styles.ServicesHint}>Choose a service to see matching pros.</p>
        </div>
        <div className={styles.ServicesGrid}>
          {detail?.services.map(service => (
            <a key={service} href={`/instant-results?q=${encodeURIComponent(service)}`} className={styles.ServiceLink}>
              {service}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function ServicesMenu({ categories }: { categories: Category[] }) {
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
        className={`${styles.headerMenuText} ${styles.headerNavItem} flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 font-normal text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors`}
        aria-expanded={open}
      >
        Explore Services
        <ChevronDown />
      </button>
      <div className={styles.servicesPopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <ServicesDropdown categories={categories} />
      </div>
    </div>
  )
}

function CustomerNavLink({ href, label, badge = 0 }: { href: string; label: string; badge?: number }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`${styles.headerMenuText} ${styles.headerNavItem} relative flex items-center gap-1 px-3 py-2 font-normal rounded-lg transition-colors ${
        active ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      <NavBadge count={badge} />
    </Link>
  )
}

function CustomerNav({ activeAppointments }: { activeAppointments: number }) {
  return (
    <>
      <CustomerNavLink href="/requests" label="My requests" />
      <CustomerNavLink href="/projects" label="Projects" />
      <CustomerNavLink href="/appointments" label="Appointments" badge={activeAppointments} />
      <CustomerNavLink href="/messages" label="Messages" />
    </>
  )
}

function CustomerProfileMenu({ user }: { user: User }) {
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
      <button className={styles.avatar} onClick={() => setOpen(v => !v)} aria-label="Account menu">
        <AvatarImg user={user} />
      </button>
      <div className={styles.profilePopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.menuUserInfo}>
          <div className={styles.menuUserName}>{user.displayName ?? 'Account'}</div>
          <div className={styles.menuUserEmail}>{user.email}</div>
        </div>
        <hr className={styles.menuSeparator} />
        <Link href="/settings" className={styles.menuItem} onClick={() => setOpen(false)}>
          Account settings
        </Link>
        <Link href="/help" className={styles.menuItem} onClick={() => setOpen(false)}>
          Help
        </Link>
        <hr className={styles.menuSeparator} />
        <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleSignOut}>
          Sign out
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
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + '/')
  return (
    <Link
      href={href}
      className={`${styles.headerMenuText} ${styles.headerNavItem} relative flex items-center gap-1 px-3 py-2 font-normal rounded-lg transition-colors ${
        active ? 'text-orange-600 bg-orange-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}
      <NavBadge count={badge} />
    </Link>
  )
}

function BellButton() {
  return (
    <button className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer border-none bg-transparent">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    </button>
  )
}

function ProAccountMenu({ user, pro }: { user: User; pro: ProBasic }) {
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
      <button className={styles.avatar} onClick={() => setOpen(v => !v)}>
        <AvatarImg user={user} />
      </button>
      <div className={styles.profilePopup} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.menuUserInfo}>
          <div className={styles.menuUserName}>{user.displayName ?? pro.fullName}</div>
          <div className={styles.menuUserEmail}>{user.email}</div>
        </div>
        <hr className={styles.menuSeparator} />
        <Link href={`/pro/${pro.uid}`} className={styles.menuItem} onClick={() => setOpen(false)}>
          Preview my profile
        </Link>
        <hr className={styles.menuSeparator} />
        <Link href="/pro/settings" className={styles.menuItem} onClick={() => setOpen(false)}>Settings</Link>
        <Link href="/pro/verification" className={styles.menuItem} onClick={() => setOpen(false)}>ID &amp; verification</Link>
        <Link href="/pro/help" className={styles.menuItem} onClick={() => setOpen(false)}>Help</Link>
        <hr className={styles.menuSeparator} />
        <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleSignOut}>Sign out</button>
      </div>
    </div>
  )
}

function ProNav({
  user,
  pro,
  pendingJobs,
  confirmedAppointments,
}: {
  user: User
  pro: ProBasic
  pendingJobs: number
  confirmedAppointments: number
}) {
  return (
    <nav className="flex items-center gap-2">
      <ProNavLink href="/pro/jobs" label="Jobs" badge={pendingJobs} />
      <ProNavLink href="/pro/work" label="My Work" badge={confirmedAppointments} />
      <ProNavLink href="/pro/messages" label="Messages" />
      <ProNavLink href="/pro/earnings" label="Earnings" />
      <ProNavLink href={`/pro/${pro.uid}`} label="Profile" />
      <BellButton />
      <div className="ml-1">
        <ProAccountMenu user={user} pro={pro} />
      </div>
    </nav>
  )
}

function MobileNavLink({ href, label, badge = 0, onClick }: { href: string; label: string; badge?: number; onClick: () => void }) {
  const pathname = usePathname()
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
}: {
  user: User | null
  pro: ProBasic | null
  pendingJobs: number
  confirmedAppointments: number
  activeAppointments: number
}) {
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
        aria-label="Open navigation menu"
        aria-expanded={open}
      >
        <MenuIcon />
      </button>

      <div className={styles.mobileMenuPanel} data-open={open ? '' : undefined} aria-hidden={!open}>
        <div className={styles.mobileMenuSection}>
          {pro && user ? (
            <>
              <MobileNavLink href="/pro/jobs" label="Jobs" badge={pendingJobs} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/work" label="My Work" badge={confirmedAppointments} onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/messages" label="Messages" onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/earnings" label="Earnings" onClick={() => setOpen(false)} />
              <MobileNavLink href={`/pro/${pro.uid}`} label="Profile" onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/settings" label="Settings" onClick={() => setOpen(false)} />
              <MobileNavLink href="/pro/help" label="Help" onClick={() => setOpen(false)} />
            </>
          ) : (
            <>
              <MobileNavLink href="/instant-results" label="Explore services" onClick={() => setOpen(false)} />
              {user && (
                <>
                  <MobileNavLink href="/requests" label="My requests" onClick={() => setOpen(false)} />
                  <MobileNavLink href="/projects" label="Projects" onClick={() => setOpen(false)} />
                  <MobileNavLink href="/appointments" label="Appointments" badge={activeAppointments} onClick={() => setOpen(false)} />
                  <MobileNavLink href="/messages" label="Messages" onClick={() => setOpen(false)} />
                  <MobileNavLink href="/settings" label="Account settings" onClick={() => setOpen(false)} />
                </>
              )}
              <MobileNavLink href="/pro" label="Join as a pro" onClick={() => setOpen(false)} />
              {!user && (
                <>
                  <MobileNavLink href="/register" label="Sign up" onClick={() => setOpen(false)} />
                  <MobileNavLink href="/login" label="Log in" onClick={() => setOpen(false)} />
                </>
              )}
            </>
          )}
        </div>

        {user && (
          <div className={styles.mobileMenuFooter}>
            <div className={styles.mobileUserInfo}>
              <span>{user.displayName ?? 'Account'}</span>
              <small>{user.email}</small>
            </div>
            <button type="button" className={styles.mobileSignOutButton} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root header ──────────────────────────────────────────────────────────────

export default function Header() {
  const [user, setUser] = useState<User | null>(null)
  const [pro, setPro] = useState<ProBasic | null>(null)
  const [resolvingAccount, setResolvingAccount] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [pendingJobs, setPendingJobs] = useState(0)
  const [confirmedProAppointments, setConfirmedProAppointments] = useState(0)
  const [activeAppointments, setActiveAppointments] = useState(0)

  // Detect auth + pro status (client Firestore first; /api/me when Admin IAM allows)
  useEffect(() => {
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
        let profile = await resolveProClient(u)
        if (!profile) {
          const token = await u.getIdToken()
          const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) {
            const data = (await res.json()) as { pro: ProBasic | null }
            profile = data.pro
          }
        }
        if (!cancelled && u.uid === uid) {
          setPro(profile)
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
  }, [])

  // Fetch pending job count for the badge
  useEffect(() => {
    if (!pro) return
    getDocs(
      query(collection(db, 'serviceRequests'), where('proUid', '==', pro.uid), where('status', '==', 'pending'))
    )
      .then(snap => setPendingJobs(snap.size))
      .catch(() => setPendingJobs(0))
  }, [pro])

  // Fetch confirmed pro appointment count for the My Work badge
  useEffect(() => {
    if (!pro) return
    let cancelled = false
    getDocs(
      query(collection(db, 'serviceRequests'), where('proUid', '==', pro.uid), where('status', '==', 'accepted'))
    )
      .then(snap => {
        const count = snap.docs.filter(doc => doc.data().appointmentRequest?.status === 'confirmed').length
        if (!cancelled) setConfirmedProAppointments(count)
      })
      .catch(() => {
        if (!cancelled) setConfirmedProAppointments(0)
      })
    return () => {
      cancelled = true
    }
  }, [pro])

  // Fetch active customer appointment count for the badge
  useEffect(() => {
    if (resolvingAccount || !user || pro) return
    let cancelled = false
    getDocs(
      query(collection(db, 'serviceRequests'), where('customerUid', '==', user.uid), where('status', '==', 'accepted'))
    )
      .then(snap => {
        const count = snap.docs.filter(doc => doc.data().appointmentRequest?.status === 'confirmed').length
        if (!cancelled) setActiveAppointments(count)
      })
      .catch(() => {
        if (!cancelled) setActiveAppointments(0)
      })
    return () => {
      cancelled = true
    }
  }, [pro, resolvingAccount, user])

  // Only fetch customer categories when NOT a pro
  useEffect(() => {
    if (resolvingAccount || pro) return
    fetch('/api/categories').then(r => r.json()).then(d => setCategories(d.categories)).catch(() => {})
  }, [pro, resolvingAccount])

  return (
    <header className={styles.headerRoot}>
      <div className={styles.headerLogoSlot}>
        <Link href={pro ? '/pro/jobs' : '/'} aria-label="Home" className={styles.logoLink}>
          <LogoMark />
        </Link>
      </div>

      {resolvingAccount ? (
        <nav className={styles.desktopNav} aria-busy="true" aria-label="Loading account navigation">
          <div className={styles.loadingNav} />
        </nav>
      ) : pro && user ? (
        <div className={styles.desktopNav}>
          <ProNav
            user={user}
            pro={pro}
            pendingJobs={pendingJobs}
            confirmedAppointments={confirmedProAppointments}
          />
        </div>
      ) : (
        <nav className={styles.desktopNav}>
          <ServicesMenu categories={categories} />
          {user && <CustomerNav activeAppointments={activeAppointments} />}
          <Link href="/pro" className={`${styles.headerMenuText} ${styles.headerNavItem} px-3 py-2 font-normal text-gray-600 hover:text-gray-900 transition-colors`}>
            Join as a pro
          </Link>
          {user ? (
            <div className="ml-1">
              <CustomerProfileMenu user={user} />
            </div>
          ) : (
            <>
              <Link href="/register">
                <Button className="rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 px-5 py-2 text-sm font-semibold text-white cursor-pointer shadow-sm transition-all">
                  Sign up
                </Button>
              </Link>
              <Link href="/login" className={`${styles.headerMenuText} ${styles.headerNavItem} px-4 py-2 font-normal text-gray-700 hover:bg-gray-100 rounded-lg transition-colors`}>
                Log in
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
        />
      )}
    </header>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getPathnameWithoutLocale } from '@/lib/i18n/config'
import { useTranslations } from '@/lib/i18n/client'
import styles from './CustomerActivityTabs.module.css'

const TABS = [
  { href: '/requests', labelKey: 'header.customerNav.requests' },
  { href: '/projects', labelKey: 'header.customerNav.projects' },
  { href: '/appointments', labelKey: 'header.customerNav.appointments' },
] as const

export default function CustomerActivityTabs() {
  const t = useTranslations()
  const pathname = getPathnameWithoutLocale(usePathname())

  return (
    <nav className={styles.tabs} aria-label={t('header.customerNav.requests')}>
      {TABS.map(tab => {
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${active ? styles.tabActive : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {t(tab.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}

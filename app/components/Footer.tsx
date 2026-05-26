'use client'

import Link from 'next/link'
import { FaFacebookF, FaInstagram, FaPinterestP, FaXTwitter } from 'react-icons/fa6'
import { MdShield } from 'react-icons/md'
import { useTranslations } from '@/lib/i18n/client'
import styles from './Footer.module.css'

const columns = [
  {
    titleKey: 'customers',
    links: [
      { labelKey: 'howToUse', href: '/help' },
      { labelKey: 'signUp', href: '/register' },
      { labelKey: 'findPros', href: '/instant-results' },
      { labelKey: 'myProjects', href: '/projects' },
      { labelKey: 'helpCenter', href: '/help' },
    ],
  },
  {
    titleKey: 'pros',
    links: [
      { labelKey: 'proLanding', href: '/pro' },
      { labelKey: 'signUpPro', href: '/pro/signup' },
      { labelKey: 'proDashboard', href: '/pro/jobs' },
      { labelKey: 'proResources', href: '/pro/help' },
      { labelKey: 'proSettings', href: '/pro/settings' },
    ],
  },
  {
    titleKey: 'support',
    links: [
      { labelKey: 'help', href: '/help' },
      { labelKey: 'safety', href: '/help' },
      { labelKey: 'terms', href: '/terms' },
      { labelKey: 'privacy', href: '/privacy' },
      { labelKey: 'accountSettings', href: '/settings' },
    ],
  },
] as const

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com', icon: FaInstagram },
  { label: 'X', href: 'https://www.x.com', icon: FaXTwitter },
  { label: 'Pinterest', href: 'https://www.pinterest.com', icon: FaPinterestP },
  { label: 'Facebook', href: 'https://www.facebook.com', icon: FaFacebookF },
] as const

export default function Footer() {
  const t = useTranslations()

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <section aria-label="Mestermind">
            <p className={styles.brandTitle}>Mestermind</p>
            <p className={styles.brandTagline}>{t('footer.brandTagline')}</p>
            <div className={styles.socialLinks}>
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  className={styles.socialLink}
                  aria-label={label}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon size={14} aria-hidden="true" />
                </a>
              ))}
            </div>
          </section>

          {columns.map(column => (
            <section key={column.titleKey} aria-labelledby={`footer-${column.titleKey}`}>
              <h2 id={`footer-${column.titleKey}`} className={styles.columnTitle}>
                {t(`footer.columns.${column.titleKey}`)}
              </h2>
              <ul className={styles.linkList}>
                {column.links.map(link => (
                  <li key={`${column.titleKey}-${link.labelKey}`}>
                    <Link href={link.href} className={styles.link}>
                      {t(`footer.links.${link.labelKey}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            <span className={styles.brandDot}>m</span>
            <span>{t('footer.copyright')}</span>
          </span>
          <span className={styles.guarantee}>
            <span className={styles.shield}>
              <MdShield size={13} aria-hidden="true" />
            </span>
            {t('footer.guarantee')}
          </span>
        </div>
      </div>
    </footer>
  )
}

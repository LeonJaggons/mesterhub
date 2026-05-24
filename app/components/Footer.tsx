import Link from 'next/link'
import { FaFacebookF, FaInstagram, FaPinterestP, FaXTwitter } from 'react-icons/fa6'
import { MdShield } from 'react-icons/md'
import styles from './Footer.module.css'

const columns = [
  {
    title: 'Customers',
    links: [
      { label: 'How to use Mestermind', href: '/help' },
      { label: 'Sign up', href: '/register' },
      { label: 'Find pros near me', href: '/instant-results' },
      { label: 'My projects', href: '/projects' },
      { label: 'Help center', href: '/help' },
    ],
  },
  {
    title: 'Pros',
    links: [
      { label: 'Mestermind for pros', href: '/pro' },
      { label: 'Sign up as a pro', href: '/pro/signup' },
      { label: 'Pro dashboard', href: '/pro/jobs' },
      { label: 'Pro resources', href: '/pro/help' },
      { label: 'Pro settings', href: '/pro/settings' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help', href: '/help' },
      { label: 'Safety', href: '/help' },
      { label: 'Terms of Use', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Account settings', href: '/settings' },
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
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <section aria-label="Mestermind">
            <p className={styles.brandTitle}>Mestermind</p>
            <p className={styles.brandTagline}>Find trusted local pros.</p>
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
            <section key={column.title} aria-labelledby={`footer-${column.title.toLowerCase()}`}>
              <h2 id={`footer-${column.title.toLowerCase()}`} className={styles.columnTitle}>
                {column.title}
              </h2>
              <ul className={styles.linkList}>
                {column.links.map(link => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link href={link.href} className={styles.link}>
                      {link.label}
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
            <span>© 2026 Mestermind, Inc.</span>
          </span>
          <span className={styles.guarantee}>
            <span className={styles.shield}>
              <MdShield size={13} aria-hidden="true" />
            </span>
            Mestermind Guarantee
          </span>
        </div>
      </div>
    </footer>
  )
}

'use client'

import Link from 'next/link'
import { useTranslations } from '@/lib/i18n/client'
import styles from '../account/account.module.css'

export default function HelpPage() {
  const t = useTranslations()

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('helpPage.title')}</h1>
        <p className={styles.subtitle}>{t('helpPage.subtitle')}</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>{t('helpPage.quote.title')}</h2>
            <p>
              {t('helpPage.quote.bodyBefore')}{' '}
              <Link href="/requests">{t('helpPage.quote.link')}</Link>.
            </p>
          </section>

          <section className={styles.helpSection}>
            <h2>{t('helpPage.contact.title')}</h2>
            <p>{t('helpPage.contact.body')}</p>
          </section>

          <section id="mestermind-guarantee" className={styles.helpSection}>
            <h2>{t('helpPage.guarantee.title')}</h2>
            <p>{t('helpPage.guarantee.body')}</p>
          </section>

          <section className={styles.helpSection}>
            <h2>{t('helpPage.pro.title')}</h2>
            <p>
              <Link href="/pro">{t('helpPage.pro.link')}</Link> {t('helpPage.pro.bodyAfter')}
            </p>
          </section>

          <section className={styles.helpSection}>
            <h2>{t('helpPage.more.title')}</h2>
            <p>
              {t('helpPage.more.bodyBefore')}{' '}
              <a href="mailto:support@mestermind.com">support@mestermind.com</a> {t('helpPage.more.bodyAfter')}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

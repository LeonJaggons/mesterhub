import Link from 'next/link'
import { getTranslations } from '@/lib/i18n/server'
import styles from '../../account/account.module.css'

export default async function ProHelpPage() {
  const t = await getTranslations()

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('proHelpPage.title')}</h1>
        <p className={styles.subtitle}>{t('proHelpPage.subtitle')}</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>{t('proHelpPage.verified.title')}</h2>
            <p>{t('proHelpPage.verified.body')}</p>
          </section>
          <section className={styles.helpSection}>
            <h2>{t('proHelpPage.quotes.title')}</h2>
            <p>{t('proHelpPage.quotes.body')}</p>
          </section>
          <section className={styles.helpSection}>
            <h2>{t('proHelpPage.accepted.title')}</h2>
            <p>{t('proHelpPage.accepted.body')}</p>
          </section>
          <section className={styles.helpSection}>
            <h2>{t('proHelpPage.support.title')}</h2>
            <p>{t('proHelpPage.support.bodyBefore')} <a href="mailto:support@mestermind.com">support@mestermind.com</a> {t('proHelpPage.support.bodyAfter')}</p>
          </section>
          <Link href="/pro/jobs" className={styles.linkBtn}>{t('proHelpPage.back')}</Link>
        </div>
      </div>
    </main>
  )
}

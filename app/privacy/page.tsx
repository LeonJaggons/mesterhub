import Link from 'next/link'
import { getTranslations } from '@/lib/i18n/server'
import styles from '../account/account.module.css'

type PolicySection = {
  id: string
  hasIntro?: boolean
  items?: readonly string[]
  hasClosing?: boolean
}

const sections: PolicySection[] = [
  {
    id: 'coverage',
    hasIntro: true,
    items: ['customers', 'pros', 'visitors'],
  },
  {
    id: 'account',
    hasIntro: true,
    items: ['customerAccounts', 'proAccounts', 'authProviders', 'noRawCredentials'],
  },
  {
    id: 'customerRequests',
    hasIntro: true,
    items: ['requestDetails', 'acceptedQuote', 'appointments', 'retention'],
  },
  {
    id: 'proOnboarding',
    hasIntro: true,
    items: ['publicProfile', 'privateAccount', 'verification', 'payout', 'localStorage'],
  },
  {
    id: 'communications',
    hasIntro: true,
    items: ['messages', 'notifications', 'emails', 'feedback'],
  },
  {
    id: 'payments',
    hasIntro: true,
    items: ['stripeReceives', 'stripeMetadata', 'stripeProcesses', 'customerPayments'],
  },
  {
    id: 'files',
    hasIntro: true,
    items: ['uploadData', 'sharingRights', 'downloadUrls'],
  },
  {
    id: 'technicalData',
    hasIntro: true,
    items: ['collectedData', 'usage', 'providers'],
  },
  {
    id: 'useInformation',
    items: ['accounts', 'profiles', 'workflows', 'communications', 'trust', 'billing', 'support', 'improve'],
  },
  {
    id: 'visibility',
    items: ['publicProfiles', 'selectedPro', 'participants', 'privateRecords', 'publishedReviews'],
  },
  {
    id: 'sharing',
    hasIntro: true,
    items: ['firebase', 'stripe', 'resend', 'otherProviders', 'legalDisclosure', 'noSale'],
  },
  {
    id: 'retention',
    hasIntro: true,
    items: ['accountProfile', 'marketplaceRecords', 'verificationRecords', 'localDrafts'],
  },
  {
    id: 'security',
    hasIntro: true,
    hasClosing: true,
  },
  {
    id: 'choices',
    items: ['accountSettings', 'proSettings', 'email', 'dataRequests', 'browserControls'],
  },
  {
    id: 'children',
    hasIntro: true,
  },
  {
    id: 'internationalUse',
    hasIntro: true,
  },
  {
    id: 'changes',
    hasIntro: true,
  },
]

export default async function PrivacyPage() {
  const t = await getTranslations()

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('privacyPage.title')}</h1>
        <p className={styles.subtitle}>{t('privacyPage.subtitle')}</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>{t('privacyPage.lastUpdated.label')}</h2>
            <p>{t('privacyPage.lastUpdated.date')}</p>
          </section>

          {sections.map(section => (
            <section className={styles.helpSection} key={section.id}>
              <h2>{t(`privacyPage.sections.${section.id}.title`)}</h2>
              {section.hasIntro && <p>{t(`privacyPage.sections.${section.id}.intro`)}</p>}
              {section.items && (
                <ul>
                  {section.items.map(item => (
                    <li key={item}>{t(`privacyPage.sections.${section.id}.items.${item}`)}</li>
                  ))}
                </ul>
              )}
              {section.hasClosing && <p>{t(`privacyPage.sections.${section.id}.closing`)}</p>}
            </section>
          ))}

          <section className={styles.helpSection}>
            <h2>{t('privacyPage.contact.title')}</h2>
            <p>{t('privacyPage.contact.bodyBefore')} <a href="mailto:support@mestermind.com">support@mestermind.com</a>.</p>
          </section>
          <Link href="/terms" className={styles.linkBtn}>{t('privacyPage.termsLink')}</Link>
        </div>
      </div>
    </main>
  )
}

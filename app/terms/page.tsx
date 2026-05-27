import Link from 'next/link'
import { getTranslations } from '@/lib/i18n/server'
import styles from '../account/account.module.css'

type TermsSection = {
  id: string
  hasIntro?: boolean
  items?: readonly string[]
  hasClosing?: boolean
}

const sections: TermsSection[] = [
  {
    id: 'agreement',
    hasIntro: true,
    items: ['acceptance', 'organizationAuthority', 'doNotUse'],
  },
  {
    id: 'whatItIs',
    hasIntro: true,
    items: ['customers', 'pros', 'independentPros', 'noHomeServices'],
  },
  {
    id: 'eligibility',
    items: ['legalCapacity', 'accurateInfo', 'accountSecurity', 'notifyMisuse', 'accessLimits'],
  },
  {
    id: 'customerResponsibilities',
    items: ['describeProjects', 'rightToRequest', 'choosePro', 'noHarmfulWork', 'keepRecords', 'acceptedQuoteInfo'],
  },
  {
    id: 'proResponsibilities',
    items: ['accurateInfo', 'qualifiedWork', 'legalCompliance', 'clearQuotes', 'professionalCommunication', 'noMisrepresentation', 'customerInfo'],
  },
  {
    id: 'requestsQuotes',
    items: ['requestInvitation', 'quoteSubmitted', 'acceptDecline', 'appointments', 'completion', 'cancellations'],
  },
  {
    id: 'customerProPayments',
    hasIntro: true,
    items: ['proResponsibility', 'customerResponsibility', 'notResponsible', 'futurePayments'],
  },
  {
    id: 'proSubscriptions',
    hasIntro: true,
    items: ['features', 'trial', 'authorization', 'promotions', 'billingPortal', 'pastDue', 'nonRefundable'],
  },
  {
    id: 'referralProgram',
    hasIntro: true,
    items: ['notGuaranteed', 'qualifyingReferral', 'manualReview', 'noAbuse', 'noSelfReferral', 'payoutMethod', 'taxes', 'changes'],
  },
  {
    id: 'verification',
    hasIntro: true,
    items: ['trustMeasure', 'badges', 'customerChecks', 'reviewProfile'],
  },
  {
    id: 'reviews',
    items: ['honestReviews', 'publishedReviews', 'noManipulation', 'moderation', 'contentLicense', 'rights'],
  },
  {
    id: 'communications',
    items: ['transactionalMessages', 'visibility', 'noMisuse', 'controls'],
  },
  {
    id: 'files',
    items: ['uploads', 'noUnsafeFiles', 'noUnnecessarySensitiveInfo', 'removeFiles'],
  },
  {
    id: 'prohibitedConduct',
    items: ['noLegalViolations', 'noImpersonation', 'noHarassment', 'noScraping', 'noSystemAbuse', 'noMalware', 'noIllegalWork'],
  },
  {
    id: 'marketplaceChanges',
    items: ['featureChanges', 'availability', 'rankingUpdates', 'evolving'],
  },
  {
    id: 'disputes',
    hasIntro: true,
    items: ['supportRole', 'documentAgreements', 'cooperation'],
  },
  {
    id: 'intellectualProperty',
    items: ['ownership', 'allowedUse', 'userContent'],
  },
  {
    id: 'privacy',
    hasIntro: true,
  },
  {
    id: 'termination',
    items: ['stopUsing', 'suspension', 'retainedRecords'],
  },
  {
    id: 'disclaimers',
    items: ['asIs', 'noGuarantees', 'noUserGuarantees', 'mandatoryRights'],
  },
  {
    id: 'liability',
    hasIntro: true,
    hasClosing: true,
  },
  {
    id: 'indemnity',
    hasIntro: true,
  },
  {
    id: 'changes',
    hasIntro: true,
  },
]

export default async function TermsPage() {
  const t = await getTranslations()

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t('termsPage.title')}</h1>
        <p className={styles.subtitle}>{t('termsPage.subtitle')}</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>{t('termsPage.lastUpdated.label')}</h2>
            <p>{t('termsPage.lastUpdated.date')}</p>
          </section>

          {sections.map(section => (
            <section className={styles.helpSection} key={section.id}>
              <h2>{t(`termsPage.sections.${section.id}.title`)}</h2>
              {section.hasIntro && <p>{t(`termsPage.sections.${section.id}.intro`)}</p>}
              {section.items && (
                <ul>
                  {section.items.map(item => (
                    <li key={item}>{t(`termsPage.sections.${section.id}.items.${item}`)}</li>
                  ))}
                </ul>
              )}
              {section.hasClosing && <p>{t(`termsPage.sections.${section.id}.closing`)}</p>}
            </section>
          ))}

          <section className={styles.helpSection}>
            <h2>{t('termsPage.support.title')}</h2>
            <p>{t('termsPage.support.bodyBefore')} <a href="mailto:support@mestermind.com">support@mestermind.com</a>.</p>
          </section>
          <Link href="/privacy" className={styles.linkBtn}>{t('termsPage.privacyLink')}</Link>
        </div>
      </div>
    </main>
  )
}

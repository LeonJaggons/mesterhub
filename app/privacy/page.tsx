import Link from 'next/link'
import styles from '../account/account.module.css'

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.subtitle}>How Mestermind handles account, request, message, and verification data during launch.</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>Information we collect</h2>
            <p>We collect account details, service request information, messages, approximate job locations, and pro verification materials needed to operate the marketplace.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>How data is used</h2>
            <p>Data is used to match customers with pros, manage quotes and appointments, send lifecycle notifications, review pro eligibility, and provide support.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Visibility</h2>
            <p>Public pro profile details can appear in search. Private verification, payout, and customer contact details are restricted to the account owner, participants in a request, or admins.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Contact</h2>
            <p>For privacy questions or data requests, contact <a href="mailto:support@mestermind.com">support@mestermind.com</a>.</p>
          </section>
          <Link href="/terms" className={styles.linkBtn}>Read terms</Link>
        </div>
      </div>
    </main>
  )
}

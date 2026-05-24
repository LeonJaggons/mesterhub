import Link from 'next/link'
import styles from '../account/account.module.css'

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.subtitle}>The launch terms for using Mestermind as a customer or pro.</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>Marketplace role</h2>
            <p>Mestermind helps customers contact independent service professionals. Quotes, scheduling, scope, and completion are agreed directly between the customer and the pro.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Requests and quotes</h2>
            <p>Customers should provide accurate project details. Pros should quote clearly, disclose material or travel costs, and only accept work they are qualified to perform.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Verification and safety</h2>
            <p>Pros may be reviewed before appearing in search, but customers should still use judgement before hiring and should keep important job details in Mestermind messages.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Support</h2>
            <p>For launch support, contact <a href="mailto:support@mestermind.com">support@mestermind.com</a>. These terms may be updated as the service matures.</p>
          </section>
          <Link href="/privacy" className={styles.linkBtn}>Read privacy policy</Link>
        </div>
      </div>
    </main>
  )
}

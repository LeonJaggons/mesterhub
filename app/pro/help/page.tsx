import Link from 'next/link'
import styles from '../../account/account.module.css'

export default function ProHelpPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Pro help</h1>
        <p className={styles.subtitle}>How to use Mestermind from signup through completed work.</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>Getting verified</h2>
            <p>Complete the pro signup steps and upload requested documents. An admin reviews pending profiles before they appear in customer search.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Quoting jobs</h2>
            <p>New requests appear under Jobs. Review the location and project answers, then send a clear quote with price, timing, and notes.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>After acceptance</h2>
            <p>Once a customer accepts your quote, use messages to confirm details and propose an appointment. Mark the job complete after the work is done.</p>
          </section>
          <section className={styles.helpSection}>
            <h2>Need support?</h2>
            <p>Email <a href="mailto:support@mestermind.com">support@mestermind.com</a> with the request ID and a short description of the issue.</p>
          </section>
          <Link href="/pro/jobs" className={styles.linkBtn}>Back to jobs</Link>
        </div>
      </div>
    </main>
  )
}

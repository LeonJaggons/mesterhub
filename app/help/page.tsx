'use client'

import Link from 'next/link'
import styles from '../account/account.module.css'

export default function HelpPage() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Help</h1>
        <p className={styles.subtitle}>Answers to common questions about using Mestermind.</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>How do I request a quote?</h2>
            <p>
              Browse services from the home page or Explore Services menu, find a pro, and fill out
              the project form on their profile. They&apos;ll respond with a quote you can review under{' '}
              <Link href="/requests">My requests</Link>.
            </p>
          </section>

          <section className={styles.helpSection}>
            <h2>When do I get the pro&apos;s contact details?</h2>
            <p>
              After you accept a quote, the pro can reach you by email. Until then, communication
              happens through the request status on your requests page.
            </p>
          </section>

          <section className={styles.helpSection}>
            <h2>Want to offer services?</h2>
            <p>
              <Link href="/pro">Join as a pro</Link> to create a business profile and receive job
              requests from customers in your area.
            </p>
          </section>

          <section className={styles.helpSection}>
            <h2>Need more help?</h2>
            <p>
              Email us at{' '}
              <a href="mailto:support@mestermind.hu">support@mestermind.hu</a> and we&apos;ll get back
              to you within one business day.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

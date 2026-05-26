import Link from 'next/link'
import styles from '../account/account.module.css'

const LAST_UPDATED = 'May 26, 2026'

type PolicySection = {
  title: string
  intro?: string
  items?: string[]
  closing?: string
}

const sections: PolicySection[] = [
  {
    title: 'Who this policy covers',
    intro: 'This Privacy Policy explains how Mestermind collects, uses, shares, and protects information when customers, service professionals, applicants, and visitors use the Mestermind website, accounts, dashboards, request flows, messaging, appointments, reviews, notifications, and related support features.',
    items: [
      'Customers are people using Mestermind to search for local professionals, create projects, request estimates, review quotes, message pros, schedule appointments, confirm completion, and leave reviews.',
      'Pros are independent service professionals using Mestermind to create a profile, complete onboarding, receive inquiries, send quotes, manage jobs, respond to messages, manage availability and notification preferences, and subscribe to Mestermind Pro.',
      'Visitors are people browsing public pages, public pro profiles, help pages, or legal pages without signing in.',
    ],
  },
  {
    title: 'Account and sign-in information',
    intro: 'We collect the information needed to create, authenticate, secure, and support accounts.',
    items: [
      'For customer accounts, this can include first name, last name, display name, email address, password credentials handled by Firebase Authentication, email verification status, phone number, preferred district, saved address, and sign-in preferences such as remember-me persistence.',
      'For pro accounts, this can include full name, email address, phone number, password credentials handled by Firebase Authentication, profile photo, category, services, service districts, radius, postcode, biography, years of experience, pricing type, hourly rate or quote preference, availability, payment methods accepted, FAQs, social links, and profile visibility.',
      'If you use Google, Facebook, magic link, password reset, or other supported authentication flows, Firebase Authentication may provide us with identifiers, email address, display name, profile image, provider information, and verification signals needed to sign you in.',
      'We do not receive or store your raw payment card number through Stripe checkout, and we do not store your account password in our application database.',
    ],
  },
  {
    title: 'Customer project and request information',
    intro: 'When a customer creates or sends a request, we collect the details needed to match the request with the selected pro and operate the workflow.',
    items: [
      'This can include the requested service category, project details and answers, customer name, customer email, selected district, approximate job location coordinates if shared, request attachments such as images or PDFs, invited pro IDs, quote status, cancellation reasons, completion status, and timestamps.',
      'If a customer accepts a quote, we collect the acceptance message and any phone number, address, preferred start date, and other coordination details the customer chooses to provide.',
      'If a pro proposes an appointment, we collect appointment type, date, time, duration, location, notes, confirmation status, and change requests.',
      'Customers can delete some non-completed requests from their view, but completed jobs, appointment-linked records, transaction history, audit logs, and information needed for safety, dispute handling, accounting, fraud prevention, or legal compliance may be retained.',
    ],
  },
  {
    title: 'Pro onboarding, verification, and profile information',
    intro: 'Pros provide additional information so Mestermind can display useful profiles, review eligibility, and support marketplace trust.',
    items: [
      'Public or profile-facing pro information can include name, profile photo, category, services, service area, postcode or district coverage, radius, biography, experience, pricing information, availability, payment methods accepted, social links, FAQs, project photos, past project descriptions, ratings, review count, and published customer reviews.',
      'Private pro account information can include email, phone number, notification preferences, subscription status, Stripe customer or subscription IDs, and internal account metadata.',
      'Verification information can include identity document uploads, selfie uploads, licence numbers, certificates, insurance documents, background-check selections, regulated-trade status, and verification review status.',
      'Payout or administrative information currently collected during onboarding can include IBAN details. If payment or payout flows change, additional provider-specific terms and disclosures may apply.',
      'Some pro signup data is temporarily saved in the browser local storage on the device used for onboarding so a pro can move between signup steps before submitting. That draft is cleared after completion or when the user clears it, but anyone with access to the same browser profile may be able to see locally stored draft data.',
    ],
  },
  {
    title: 'Messages, notifications, emails, and feedback',
    intro: 'Mestermind keeps records of communications needed to run the marketplace and notify participants.',
    items: [
      'Messages between customers and pros can include sender ID, sender role, message text, timestamps, request ID, last-message previews, and pending digest counts.',
      'In-app notifications can include recipient ID, actor ID, actor role, notification type, title, body, link, request ID, metadata, created time, and read time.',
      'Lifecycle emails can include recipient email, subject, text, HTML body, preview text, event name, request ID, metadata, delivery status, provider ID, error details, and timestamp.',
      'Feedback submitted through the feedback tool can include feedback type, message, page path, email address, user ID if signed in, user name, user agent, referrer, viewport, status, and timestamp.',
    ],
  },
  {
    title: 'Payments and subscriptions',
    intro: 'Mestermind uses Stripe for pro subscription checkout, billing portal access, subscription status, trials, promotions, invoices, and payment status updates.',
    items: [
      'When a pro starts checkout or manages billing, Stripe may receive name, email address, Firebase user ID metadata, selected price, promotion-code usage, billing details, payment method details, invoice details, and transaction records.',
      'Mestermind stores Stripe customer ID, subscription ID, price ID, subscription status, current period end, and related billing metadata so the app can determine whether pro features are trialing, active, past due, unpaid, canceled, or inactive.',
      'Stripe processes card and bank-payment details under its own services and policies. Mestermind does not store full card numbers or card security codes on our servers.',
      'Customer payments to pros are currently arranged directly between the customer and the independent pro using the methods the pro lists or agrees to, unless Mestermind later introduces an in-app customer payment product.',
    ],
  },
  {
    title: 'Files and uploads',
    intro: 'The app supports image and PDF uploads for pro onboarding, pro work examples, verification materials, and request attachments.',
    items: [
      'Uploads can include file name, file type, file size, owner user ID, storage path, download URL, access token, and content such as photos, PDFs, identity documents, certificates, insurance documents, selfies, work photos, before-and-after photos, and request images.',
      'Do not upload information you do not have the right to share. Customers should avoid including unnecessary personal, financial, health, or highly sensitive information in request attachments.',
      'Download URLs may allow access to the uploaded file for anyone who has the URL, depending on storage configuration. Treat shared upload links as sensitive.',
    ],
  },
  {
    title: 'Device, usage, and technical data',
    intro: 'We may collect technical information automatically or through service providers when you use the app.',
    items: [
      'This can include IP address, browser type, device information, user agent, referrer, approximate location inferred from technical data, page paths, authentication tokens, session persistence choices, error logs, request logs, and timestamps.',
      'We use this data to keep the service secure, debug issues, prevent abuse, improve flows, understand product usage, and support users.',
      'The current codebase uses Firebase, Firebase Admin, Firebase Storage, Firestore, Stripe, Resend, Vercel or hosting infrastructure, and browser APIs such as local storage, clipboard, share, and geolocation only when the product flow asks for that capability.',
    ],
  },
  {
    title: 'How we use information',
    items: [
      'Create, authenticate, and maintain customer and pro accounts.',
      'Display searchable pro profiles and relevant public information.',
      'Create projects, send requests to pros, hide or reveal request details based on pro access rules, and manage quote, acceptance, appointment, cancellation, completion, and review workflows.',
      'Send transactional emails, in-app notifications, message digests, appointment reminders, request reminders, quote reminders, review requests, and support communications.',
      'Review pro eligibility, verification materials, profile quality, marketplace safety, reports, disputes, and policy compliance.',
      'Process pro subscription checkout, billing portal access, billing status, trials, discounts, and subscription feature access.',
      'Provide customer support, investigate bugs, respond to feedback, prevent fraud and abuse, enforce terms, and comply with legal obligations.',
      'Improve the product, onboarding, search, ranking, marketplace health, trust, safety, and user experience.',
    ],
  },
  {
    title: 'Who can see what',
    items: [
      'Public visitors and customers can see information published on visible pro profiles, such as profile name, service category, bio, service area, pricing signals, availability, photos, ratings, and published reviews.',
      'A selected pro can see the customer request information needed to evaluate and respond to the job. Some inquiry details may be limited for free access and made available based on trial or paid pro feature access.',
      'Customers and pros who are participants in a request can see related request status, quotes, messages, appointment details, completion details, cancellation details, and review prompts relevant to that request.',
      'Private verification documents, payout details, internal billing IDs, and admin review fields are intended for the account owner, authorized Mestermind administrators, and service providers who need them to operate or secure the service.',
      'Published reviews can display a shortened customer name, rating, comment, service category, and related pro profile information.',
    ],
  },
  {
    title: 'Service providers and sharing',
    intro: 'We share information with service providers only as needed to operate Mestermind, provide requested features, secure the app, or comply with law.',
    items: [
      'Firebase and Google Cloud services provide authentication, database, storage, server-side administration, and security infrastructure.',
      'Stripe provides subscription checkout, billing portal, payment processing, invoice, promotion-code, and webhook services for pro subscriptions.',
      'Resend provides transactional email delivery and related delivery records.',
      'Hosting, analytics, logging, monitoring, customer support, fraud prevention, and professional advisers may process limited information as needed for their roles.',
      'We may disclose information if required by law, legal process, court order, government request, to protect rights and safety, to investigate abuse, or as part of a merger, acquisition, financing, reorganization, or sale of assets.',
      'We do not sell personal information in the ordinary meaning of selling a customer list for money. If that changes, this policy will be updated.',
    ],
  },
  {
    title: 'Retention',
    intro: 'We keep information for as long as reasonably needed for the purposes described in this policy.',
    items: [
      'Account and profile information is generally kept while the account exists or while needed for support, safety, tax, accounting, fraud prevention, legal compliance, and dispute resolution.',
      'Request, quote, message, appointment, completion, review, notification, billing, email, and audit records may be retained after a request ends because they document marketplace activity and support trust and safety.',
      'Verification, identity, insurance, certificate, and payout information is retained only as long as reasonably needed for onboarding, eligibility review, fraud prevention, dispute handling, legal compliance, or business records.',
      'Browser local storage draft data remains on the device until cleared by the app, browser, or user.',
    ],
  },
  {
    title: 'Security',
    intro: 'We use technical and organizational measures designed to protect information, including authenticated API access, Firebase security tooling, server-side authorization checks, upload limits, provider webhooks with signature verification, and role-based visibility in product flows.',
    closing: 'No internet service is completely secure. Please use a strong password, protect your email account, keep your devices secure, and avoid sending sensitive information that is not needed for a job.',
  },
  {
    title: 'Your choices and rights',
    items: [
      'You can update many customer account details in account settings and pro profile details in pro settings.',
      'Pros can pause profile visibility, update public profile information, change notification preferences, manage billing through Stripe, or contact support for help with verification or account records.',
      'You can unsubscribe from non-essential marketing emails if such emails are introduced. Transactional emails about requests, quotes, appointments, billing, security, and account activity may still be sent when needed to provide the service.',
      'You can request access, correction, deletion, export, or restriction of your personal information by contacting support. We may need to verify your identity and may retain some information where required or permitted for legal, safety, accounting, dispute, or legitimate business reasons.',
      'You can control browser storage, cookies, and permissions such as location sharing through your browser or device settings.',
    ],
  },
  {
    title: 'Children',
    intro: 'Mestermind is not intended for children under 16, and we do not knowingly collect personal information from children. If you believe a child provided personal information, contact us so we can review and take appropriate action.',
  },
  {
    title: 'International use',
    intro: 'Mestermind may use service providers and infrastructure that process information in countries other than where you live. Those countries may have different data protection laws. Where required, we rely on appropriate safeguards for cross-border processing.',
  },
  {
    title: 'Changes to this policy',
    intro: 'We may update this Privacy Policy as Mestermind changes, including when new payment flows, verification providers, analytics, messaging, or marketplace features are introduced. The updated version will be posted here with a new effective date. Material changes may also be communicated in the app or by email when appropriate.',
  },
]

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.subtitle}>How Mestermind handles account, marketplace, verification, payment, message, and support data.</p>

        <div className={styles.card}>
          <section className={styles.helpSection}>
            <h2>Last updated</h2>
            <p>{LAST_UPDATED}</p>
          </section>

          {sections.map(section => (
            <section className={styles.helpSection} key={section.title}>
              <h2>{section.title}</h2>
              {section.intro && <p>{section.intro}</p>}
              {section.items && (
                <ul>
                  {section.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.closing && <p>{section.closing}</p>}
            </section>
          ))}

          <section className={styles.helpSection}>
            <h2>Contact</h2>
            <p>For privacy questions, account requests, verification concerns, or data requests, contact <a href="mailto:support@mestermind.com">support@mestermind.com</a>.</p>
          </section>
          <Link href="/terms" className={styles.linkBtn}>Read terms</Link>
        </div>
      </div>
    </main>
  )
}

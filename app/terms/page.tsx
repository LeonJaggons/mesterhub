import Link from 'next/link'
import styles from '../account/account.module.css'

const LAST_UPDATED = 'May 26, 2026'

type TermsSection = {
  title: string
  intro?: string
  items?: string[]
  closing?: string
}

const sections: TermsSection[] = [
  {
    title: 'Agreement to these terms',
    intro: 'These Terms of Service govern access to and use of Mestermind, including customer accounts, pro accounts, public pro profiles, project requests, quotes, messaging, appointments, reviews, notifications, pro onboarding, verification, subscriptions, support, and related services.',
    items: [
      'By creating an account, submitting a request, applying as a pro, subscribing to Mestermind Pro, sending a message, posting a review, or otherwise using Mestermind, you agree to these terms.',
      'If you use Mestermind for a company, trade business, partnership, or other organization, you represent that you have authority to bind that organization.',
      'If you do not agree to these terms, do not use Mestermind.',
    ],
  },
  {
    title: 'What Mestermind is',
    intro: 'Mestermind is a marketplace and workflow platform that helps customers discover independent local service professionals and helps pros receive and manage inquiries.',
    items: [
      'Customers can search for pros, create saved projects, send requests, receive quotes, accept or decline quotes, message pros, coordinate appointments, confirm completion, and leave reviews.',
      'Pros can create public profiles, submit onboarding and verification information, receive inquiries, send quotes, message customers, propose appointments, manage profile settings, and subscribe to paid pro features.',
      'Mestermind is not the customer, employer, contractor, subcontractor, agent, insurer, or guarantor of any pro. Pros are independent businesses or individuals responsible for their own services, licenses, taxes, insurance, tools, materials, labor, scheduling, pricing, work quality, safety, and legal compliance.',
      'Mestermind does not perform home services, supervise job sites, control how pros perform work, or guarantee that a customer and pro will agree on a job.',
    ],
  },
  {
    title: 'Eligibility and account responsibility',
    items: [
      'You must be legally able to enter into these terms and use the service lawfully in your location.',
      'You must provide accurate account, profile, request, billing, verification, contact, and support information and keep it updated.',
      'You are responsible for activity under your account and for protecting your password, email account, devices, and authentication methods.',
      'You must notify Mestermind promptly if you suspect unauthorized access, account misuse, or inaccurate profile or request information.',
      'Mestermind may refuse, suspend, limit, or terminate access if information appears inaccurate, unsafe, fraudulent, unlawful, misleading, abusive, or inconsistent with these terms.',
    ],
  },
  {
    title: 'Customer responsibilities',
    items: [
      'Customers must describe projects honestly and with enough detail for a pro to evaluate the work, including relevant location, access, timing, photos, constraints, risks, materials, measurements, and known issues.',
      'Customers must have the right to request the work and to share any address, photos, documents, or other information submitted through Mestermind.',
      'Customers are responsible for choosing whether to hire a pro, reviewing quotes, asking questions, verifying credentials that matter for the job, confirming licensing or insurance where appropriate, and deciding whether the pro is suitable.',
      'Customers must not request unlawful, unsafe, discriminatory, deceptive, exploitative, or harmful work.',
      'Customers should keep important job details, quote discussions, appointment changes, cancellation reasons, and completion confirmations in Mestermind messages or request flows when possible so there is a clear record.',
      'When a customer accepts a quote, the customer is responsible for the information shared with the pro, including phone number, address, preferred start date, and appointment availability.',
    ],
  },
  {
    title: 'Pro responsibilities',
    items: [
      'Pros must provide accurate profile, category, service area, availability, pricing, payment-method, credential, insurance, certificate, licence, identity, and business information.',
      'Pros must only quote, accept, schedule, and perform work they are qualified and legally permitted to perform.',
      'Pros are responsible for required licenses, registrations, permits, inspections, insurance, tax obligations, invoices, receipts, employment obligations, subcontractors, safety practices, and compliance with trade, consumer, advertising, data protection, and other applicable laws.',
      'Pros must quote clearly, including what is included, what is excluded, expected timeline, assumptions, travel charges, materials, VAT or tax handling, and circumstances that may change the price.',
      'Pros must communicate professionally, respond to inquiries in good faith, honor confirmed appointments where reasonably possible, and update customers promptly if scope, timing, price, or availability changes.',
      'Pros must not misrepresent reviews, experience, identity, insurance, licences, certificates, background checks, availability, pricing, or affiliation with Mestermind.',
      'Pros are responsible for customer information they receive through Mestermind and may use it only to evaluate, quote, schedule, perform, support, and document the specific customer request, unless the customer separately agrees otherwise.',
    ],
  },
  {
    title: 'Requests, quotes, appointments, and completion',
    items: [
      'A request is an invitation for a pro to review project details and decide whether to quote or decline. It is not a guarantee that the pro will respond, be available, or accept the job.',
      'A quote is submitted by the pro, not by Mestermind. The pro is responsible for quote accuracy, assumptions, and compliance with applicable pricing and consumer laws.',
      'A customer may accept or decline a quote through Mestermind. Acceptance opens a conversation and may share additional contact, address, timing, and coordination details with the pro.',
      'Appointments proposed or confirmed in Mestermind are coordination records between the customer and pro. The parties remain responsible for attendance, rescheduling, access, safety, and any cancellation terms they agree to.',
      'A pro may mark work complete and a customer may confirm completion. Completion records help support review prompts and marketplace history but do not replace any written contract, statutory rights, warranty, invoice, receipt, or dispute rights between customer and pro.',
      'Customers and pros may cancel eligible requests in the app. Some completed jobs, appointment-linked records, messages, reviews, and audit records may remain for safety, support, legal, and marketplace integrity reasons.',
    ],
  },
  {
    title: 'Payments between customers and pros',
    intro: 'Unless Mestermind introduces a separate in-app customer payment feature, customers pay pros directly outside Mestermind using the method agreed between the customer and pro.',
    items: [
      'Pros are responsible for collecting customer payments, issuing invoices or receipts, handling deposits, tax, VAT, refunds, warranty claims, and charge disputes related to their services.',
      'Customers are responsible for reviewing payment terms before hiring, including deposits, staged payments, materials, travel costs, cancellation fees, call-out fees, and payment due dates.',
      'Mestermind is not responsible for direct customer-to-pro payment collection, refunds, chargebacks, disputed invoices, cash payments, bank transfers, card terminals, or third-party payment links used by pros outside Mestermind.',
      'If Mestermind later offers in-app customer payments, separate payment terms, processor terms, fees, refund rules, and payout rules may apply.',
    ],
  },
  {
    title: 'Mestermind Pro subscriptions and billing',
    intro: 'Pros may receive trial access or subscribe to Mestermind Pro features through Stripe checkout and the Stripe billing portal.',
    items: [
      'Subscription features may include profile visibility benefits, priority placement, review visibility, direct inquiries, expanded inquiry detail access, or other pro tools described in the app at the time.',
      'The first month may be offered as a trial during onboarding. Trial terms, duration, renewal behavior, and availability can change and may depend on the checkout flow and Stripe configuration shown at signup.',
      'By starting a paid subscription, the pro authorizes Stripe and Mestermind to charge the selected payment method for recurring fees, taxes, and applicable charges until canceled.',
      'Promotional codes, discounts, trials, and feature access may be limited, changed, revoked, or corrected if used improperly, configured incorrectly, or inconsistent with the intended offer.',
      'A pro can manage eligible billing details, payment methods, invoices, and cancellation through the Stripe billing portal where available.',
      'If a subscription is past due, unpaid, canceled, incomplete, or inactive, Mestermind may limit, pause, hide, or remove paid pro features, including request-detail access or profile advantages.',
      'Subscription fees are generally non-refundable except where required by law or expressly stated in writing by Mestermind.',
    ],
  },
  {
    title: 'Verification, badges, and trust signals',
    intro: 'Mestermind may review pro profiles, identity documents, selfies, certificates, insurance documents, licence numbers, background-check selections, and other information before or after a profile appears in search.',
    items: [
      'Verification review is a platform trust measure, not a guarantee that a pro is licensed, insured, qualified, available, solvent, safe, compliant, or suitable for any specific job.',
      'Badges, ratings, review counts, profile status, verification status, or subscription status can be delayed, incorrect, incomplete, expired, or based on information available at the time of review.',
      'Customers should still perform their own checks for important work, including identity, references, insurance, permits, trade credentials, registrations, written quotes, invoices, and safety requirements.',
      'Mestermind may approve, reject, suspend, hide, or re-review a pro profile at any time if information is missing, outdated, suspicious, disputed, unsafe, unlawful, or inconsistent with marketplace standards.',
    ],
  },
  {
    title: 'Reviews and public content',
    items: [
      'Customers may review a pro after a completed job. Reviews should be honest, relevant, based on real experience, and not abusive, discriminatory, defamatory, misleading, promotional, or retaliatory.',
      'Published reviews may show a shortened customer name, rating, comment, service category, and related pro profile information.',
      'Pros must not buy, fake, pressure, gate, manipulate, suppress, or retaliate over reviews.',
      'Mestermind may moderate, remove, hide, investigate, or refuse reviews and other content that appear fraudulent, irrelevant, unlawful, unsafe, abusive, privacy-invasive, conflicted, or inconsistent with these terms.',
      'By submitting reviews, profile content, photos, documents, messages, feedback, or other content, you grant Mestermind a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, publish, transmit, adapt for formatting, and use that content as needed to operate, improve, market, secure, and support Mestermind.',
      'You represent that you have the rights needed to submit content and that your content does not violate another person rights, privacy, intellectual property, contract, or law.',
    ],
  },
  {
    title: 'Messaging, notifications, and email',
    items: [
      'Mestermind may send transactional emails, in-app notifications, message digests, appointment reminders, request reminders, quote reminders, review requests, password reset messages, login links, billing notices, account notices, and support messages.',
      'Messages and request activity may be visible to the customer, the selected pro, and authorized Mestermind administrators or service providers who need access for support, safety, debugging, or legal reasons.',
      'You must not use messages, notifications, or contact details to spam, harass, scrape, phish, bypass Mestermind controls, send malware, solicit unrelated services, or misuse personal information.',
      'Mestermind may throttle, filter, block, or review communications where needed to protect users, prevent abuse, or maintain the service.',
    ],
  },
  {
    title: 'Files and sensitive information',
    items: [
      'Users may upload images or PDFs for request attachments, pro work examples, identity review, selfies, certificates, insurance documents, and other supported flows.',
      'Do not upload files that are unlawful, unsafe, malicious, infringing, misleading, privacy-invasive, or unrelated to the intended flow.',
      'Do not submit unnecessary sensitive information, including government IDs, financial data, health information, precise personal details, or third-party personal information unless the flow requires it and you have the right to share it.',
      'Mestermind may remove files, limit uploads, reject unsupported file types, or report content where required by law or safety obligations.',
    ],
  },
  {
    title: 'Prohibited conduct',
    items: [
      'Do not violate laws, regulations, licenses, permits, contracts, intellectual property rights, privacy rights, or third-party rights.',
      'Do not impersonate anyone, misrepresent affiliation, create fake accounts, submit false verification materials, manipulate ratings, or provide misleading request or profile information.',
      'Do not harass, threaten, discriminate, exploit, abuse, stalk, defame, or endanger users, pros, Mestermind staff, or third parties.',
      'Do not scrape, copy, harvest, sell, rent, or misuse user data, customer leads, pro profiles, messages, reviews, or marketplace content.',
      'Do not reverse engineer, probe, overload, attack, bypass, interfere with, or compromise Mestermind systems, authentication, storage, billing, ranking, or security controls.',
      'Do not upload malware, spam, deceptive links, illegal content, or content that infringes another person rights.',
      'Do not use Mestermind to coordinate work that is illegal, unsafe, fraudulent, discriminatory, or outside the pro qualifications.',
    ],
  },
  {
    title: 'Marketplace availability and changes',
    items: [
      'Mestermind may change, suspend, discontinue, rename, redesign, limit, or add features, plans, trials, pricing, search, rankings, badges, categories, service areas, request limits, and access rules.',
      'The service may be unavailable or degraded due to maintenance, bugs, hosting issues, third-party provider issues, security incidents, network problems, or events outside Mestermind control.',
      'Mestermind may update public pro profile ranking, search visibility, inquiry access, or paid feature rules to improve marketplace quality, safety, or business operations.',
      'Mestermind is currently evolving, and launch-stage features may change quickly as flows, payments, verification, and marketplace operations mature.',
    ],
  },
  {
    title: 'Disputes between customers and pros',
    intro: 'Customers and pros are responsible for resolving disputes about quotes, attendance, work quality, scope, payment, damage, refunds, warranties, cancellations, safety, and legal compliance.',
    items: [
      'Mestermind may help by providing support, preserving records, reviewing reports, moderating content, limiting accounts, or facilitating communication, but Mestermind is not required to mediate, arbitrate, pay, refund, repair, insure, warranty, or resolve disputes between customers and pros.',
      'Users should document important agreements in writing, keep invoices and receipts, check legal requirements, and use appropriate dispute channels outside Mestermind when needed.',
      'Mestermind may cooperate with law enforcement, regulators, insurers, payment processors, or legal requests where appropriate or required.',
    ],
  },
  {
    title: 'Intellectual property',
    items: [
      'Mestermind, the Mestermind name, branding, design, software, workflows, copy, visual elements, and platform content are owned by Mestermind or its licensors and are protected by applicable intellectual property laws.',
      'You may use Mestermind only as allowed by these terms and the product interface. You may not copy, resell, sublicense, or exploit the service or platform content except as expressly permitted.',
      'Mestermind does not claim ownership of user-submitted content, but needs the license described in these terms to operate, display, improve, promote, secure, and support the marketplace.',
    ],
  },
  {
    title: 'Privacy',
    intro: 'The Privacy Policy explains how Mestermind collects, uses, stores, shares, and protects personal information. By using Mestermind, you also agree that Mestermind may process information as described in the Privacy Policy.',
  },
  {
    title: 'Suspension and termination',
    items: [
      'You may stop using Mestermind at any time. Pros should cancel paid subscriptions through the billing portal where available to stop future charges.',
      'Mestermind may suspend, restrict, hide, or terminate accounts, profiles, requests, content, subscriptions, or feature access if we believe there is inaccurate information, non-payment, abuse, fraud, safety risk, legal risk, policy violation, provider issue, or harm to the marketplace.',
      'Termination does not automatically delete records that Mestermind reasonably retains for billing, tax, legal compliance, security, dispute handling, fraud prevention, audit logs, support, or legitimate business purposes.',
    ],
  },
  {
    title: 'Disclaimers',
    items: [
      'Mestermind is provided on an as-is and as-available basis. To the fullest extent permitted by law, Mestermind disclaims warranties of merchantability, fitness for a particular purpose, non-infringement, availability, accuracy, and error-free operation.',
      'Mestermind does not guarantee customer demand, pro earnings, lead volume, quote acceptance, job quality, review outcomes, ranking, search placement, identity accuracy, credential accuracy, subscription results, or uninterrupted access.',
      'Mestermind does not guarantee the acts, omissions, statements, qualifications, pricing, work, safety, legality, insurance, warranties, or payments of customers or pros.',
      'Nothing in these terms excludes warranties, rights, or remedies that cannot be excluded under applicable law.',
    ],
  },
  {
    title: 'Limitation of liability',
    intro: 'To the fullest extent permitted by law, Mestermind and its owners, employees, contractors, providers, and affiliates will not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages, lost profits, lost revenue, lost data, lost goodwill, business interruption, substitute services, or marketplace outcomes arising from or related to the service.',
    closing: 'To the fullest extent permitted by law, Mestermind total liability for claims related to the service will be limited to the greater of the amount you paid to Mestermind for the service giving rise to the claim during the three months before the claim or 100 euros. Some jurisdictions do not allow certain limitations, so some limits may not apply.',
  },
  {
    title: 'Indemnity',
    intro: 'To the fullest extent permitted by law, you agree to defend, indemnify, and hold Mestermind harmless from claims, losses, liabilities, damages, costs, and expenses, including reasonable legal fees, arising from your content, your work, your requests, your payments, your dispute with another user, your violation of these terms, your violation of law, or your misuse of Mestermind.',
  },
  {
    title: 'Changes to these terms',
    intro: 'Mestermind may update these terms as the service, flows, payments, verification, subscriptions, or marketplace operations change. The updated terms will be posted on this page with a new effective date. Continued use after changes means you accept the updated terms.',
  },
]

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.subtitle}>Detailed terms for using Mestermind as a customer, pro, subscriber, or visitor.</p>

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
            <h2>Support</h2>
            <p>For account, billing, marketplace, safety, privacy, or launch support, contact <a href="mailto:support@mestermind.com">support@mestermind.com</a>.</p>
          </section>
          <Link href="/privacy" className={styles.linkBtn}>Read privacy policy</Link>
        </div>
      </div>
    </main>
  )
}

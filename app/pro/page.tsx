import Link from 'next/link'

const BENEFITS = [
  {
    title: 'Get found by thousands',
    body: 'Mestermind connects you with customers actively searching for your services across all 23 Budapest districts.',
  },
  {
    title: 'You control your schedule',
    body: 'Accept only the jobs you want, when you want them. No pressure, no commitments you didn\'t agree to.',
  },
  {
    title: 'Get paid fairly',
    body: 'Set your own rates. Customers see your starting price upfront, so the people who contact you are already interested.',
  },
  {
    title: 'Build your reputation',
    body: 'Every completed job is an opportunity for a verified review. Great work compounds — your profile gets stronger over time.',
  },
]

const STEPS = [
  {
    number: '1',
    title: 'Create your profile',
    body: 'Tell us about your services, experience, and pricing. Takes less than 10 minutes.',
  },
  {
    number: '2',
    title: 'Get matched with jobs',
    body: 'We surface your profile to customers looking for exactly what you offer, in your district.',
  },
  {
    number: '3',
    title: 'Win the job. Get paid.',
    body: 'Quote, confirm, and complete. Reviews build automatically after each job.',
  },
]

const STATS = [
  { value: '12,000+', label: 'Job requests per month' },
  { value: '23', label: 'Budapest districts covered' },
  { value: '4.9★', label: 'Average pro rating' },
  { value: 'Free', label: 'To join and browse jobs' },
]

const FAQ = [
  {
    q: 'Is it free to join?',
    a: 'Yes. Creating a profile and browsing job requests is completely free. We only charge a small fee when you win a job through the platform.',
  },
  {
    q: 'What types of professionals can join?',
    a: 'Anyone offering a home or personal service — cleaners, handymen, electricians, plumbers, photographers, tutors, personal trainers, and more.',
  },
  {
    q: 'How do I get reviews?',
    a: 'After every completed job, the customer receives an automatic prompt to leave a review. You don\'t need to ask — we handle it.',
  },
  {
    q: 'Can I set my own prices?',
    a: 'Absolutely. You set a starting price that customers see on your profile, and you quote each job individually based on the details.',
  },
]

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export default function JoinAsProPage() {
  return (
    <main>
      {/* ── Hero ── */}
      <section className="bg-gray-900 text-white py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-400 mb-4">For professionals</p>
          <h1
            className="text-5xl md:text-6xl font-black leading-[1.05] mb-6"
            style={{ ...dg, letterSpacing: '-0.03em' }}
          >
            Grow your business.<br />
            <span className="text-orange-400">On your terms.</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Join 1,200+ professionals already using Mestermind to find clients, build their reputation, and grow their income across Budapest.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pro/signup"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-8 py-3.5 text-base transition-colors"
            >
              Create your free profile
            </Link>
            <Link
              href="#how-it-works"
              className="inline-block border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-semibold rounded-lg px-8 py-3.5 text-base transition-colors"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b border-gray-100 bg-gray-50 py-5">
        <dl className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center py-4 md:py-0 text-center px-6">
              <dt className="text-4xl font-black text-gray-900" style={dg}>{s.value}</dt>
              <dd className="text-xs text-gray-400 mt-1">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Benefits ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Why Mestermind</p>
          <h2
            className="text-4xl font-black text-gray-900 mb-2"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            Everything you need to win more jobs.
          </h2>
          <p className="text-gray-500 text-base mb-12">Built for independent professionals who want to spend more time working and less time finding work.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex gap-4">
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-orange-500 mt-2.5" />
                <div>
                  <h3
                    className="text-xl font-black text-gray-900 mb-2"
                    style={dg}
                  >
                    {b.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Getting started</p>
          <h2
            className="text-4xl font-black text-gray-900 mb-2"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            Up and running in three steps.
          </h2>
          <p className="text-gray-500 text-base mb-12">No complicated setup. No waiting for approval. Start receiving enquiries the same day.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.number} className="flex flex-col gap-4">
                <div
                  className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-xl flex-shrink-0"
                  style={dg}
                >
                  {step.number}
                </div>
                <h3 className="font-black text-xl text-gray-900" style={dg}>{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 border-t border-gray-100">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">FAQ</p>
          <h2
            className="text-4xl font-black text-gray-900 mb-12"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            Common questions.
          </h2>
          <div className="divide-y divide-gray-100">
            {FAQ.map((item) => (
              <div key={item.q} className="py-6">
                <h3
                  className="text-lg font-black text-gray-900 mb-2"
                  style={dg}
                >
                  {item.q}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-4 bg-orange-500 text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2
            className="text-5xl font-black mb-5 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.03em' }}
          >
            Ready to get started?
          </h2>
          <p className="text-orange-100 text-base mb-10 leading-relaxed">
            Create your free profile today and start receiving job requests from customers across Budapest.
          </p>
          <Link
            href="/pro/signup"
            className="inline-block bg-white text-orange-600 hover:bg-orange-50 font-semibold rounded-lg px-9 py-3.5 text-base transition-colors"
          >
            Create your free profile
          </Link>
        </div>
      </section>
    </main>
  )
}

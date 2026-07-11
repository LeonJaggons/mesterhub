import type { Metadata } from 'next'
import Link from 'next/link'
import JsonLd from '@/app/components/JsonLd'
import { getTranslations } from '@/lib/i18n/server'
import { getRequestLocale } from '@/lib/i18n/server'
import { faqJsonLd, localizedMetadata, localizedPath, siteName, siteUrl } from '@/lib/seo'

const BENEFITS = [
  'found',
  'schedule',
  'paid',
  'reputation',
] as const

const STEPS = [
  { number: '1', key: 'profile' },
  { number: '2', key: 'matched' },
  { number: '3', key: 'paid' },
] as const

const STATS = [
  { value: '12,000+', key: 'jobRequests' },
  { value: '23', key: 'districts' },
  { value: '4.9★', key: 'rating' },
  { valueKey: 'freeValue', key: 'free' },
] as const

const FAQ = [
  'free',
  'types',
  'reviews',
  'prices',
] as const

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  return localizedMetadata({
    locale,
    paths: {
      en: localizedPath('en', '/pro'),
      hu: localizedPath('hu', '/pro'),
    },
    title: locale === 'hu'
      ? 'Csatlakozz szakemberként Budapesten | Mestermind'
      : 'Join Mestermind as a Budapest professional',
    description: locale === 'hu'
      ? 'Szerezz több budapesti munkát, építs értékeléseket, és kezeld az ajánlatkéréseket a Mestermind szakember platformján.'
      : 'Get more Budapest jobs, build reviews, and manage quote requests on the Mestermind professional marketplace.',
  })
}

export default async function JoinAsProPage() {
  const t = await getTranslations()
  const locale = await getRequestLocale()
  const proFaq = FAQ.map(item => ({
    question: t(`proLanding.faq.${item}.question`),
    answer: t(`proLanding.faq.${item}.answer`),
  }))

  return (
    <main>
      <JsonLd data={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: locale === 'hu' ? 'Mestermind szakembereknek' : 'Mestermind for professionals',
          url: `${siteUrl}${localizedPath(locale, '/pro')}`,
          isPartOf: {
            '@type': 'WebSite',
            name: siteName,
            url: siteUrl,
          },
        },
        faqJsonLd(proFaq),
      ]} />
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden bg-gray-950 bg-cover bg-center px-4 py-28 text-white"
        style={{ backgroundImage: "url('/img/pro-hero.png')" }}
      >
        <div className="absolute inset-0 bg-gray-950/45" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/50 via-gray-950/18 to-gray-950/40" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-sky-400 mb-4">{t('proLanding.hero.eyebrow')}</p>
          <h1
            className="text-5xl md:text-6xl font-black leading-[1.05] mb-6"
            style={{ ...dg, letterSpacing: '-0.03em' }}
          >
            {t('proLanding.hero.headlineLine1')}<br />
            <span className="text-sky-400">{t('proLanding.hero.headlineLine2')}</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            {t('proLanding.hero.body')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pro/signup"
              className="inline-block bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded px-8 py-3.5 text-base transition-colors"
            >
              {t('proLanding.hero.primaryCta')}
            </Link>
            <Link
              href="#how-it-works"
              className="inline-block rounded bg-white px-8 py-3.5 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-100"
            >
              {t('proLanding.hero.secondaryCta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b border-gray-100 bg-gray-50 py-5">
        <dl className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {STATS.map((s) => (
            <div key={s.key} className="flex flex-col items-center py-4 md:py-0 text-center px-6">
              <dt className="text-4xl font-black text-gray-900" style={dg}>{'valueKey' in s ? t(`proLanding.stats.${s.valueKey}`) : s.value}</dt>
              <dd className="text-xs text-gray-400 mt-1">{t(`proLanding.stats.${s.key}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Benefits ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proLanding.benefits.eyebrow')}</p>
          <h2
            className="text-4xl font-black text-gray-900 mb-2"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {t('proLanding.benefits.headline')}
          </h2>
          <p className="text-gray-500 text-base mb-12">{t('proLanding.benefits.body')}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex gap-4">
                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-sky-500 mt-2.5" />
                <div>
                  <h3
                    className="text-xl font-black text-gray-900 mb-2"
                    style={dg}
                  >
                    {t(`proLanding.benefits.${benefit}.title`)}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{t(`proLanding.benefits.${benefit}.body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proLanding.steps.eyebrow')}</p>
          <h2
            className="text-4xl font-black text-gray-900 mb-2"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {t('proLanding.steps.headline')}
          </h2>
          <p className="text-gray-500 text-base mb-12">{t('proLanding.steps.body')}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.number} className="flex flex-col gap-4">
                <div
                  className="w-12 h-12 rounded-full bg-sky-500 text-white flex items-center justify-center font-black text-xl flex-shrink-0"
                  style={dg}
                >
                  {step.number}
                </div>
                <h3 className="font-black text-xl text-gray-900" style={dg}>{t(`proLanding.steps.${step.key}.title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`proLanding.steps.${step.key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-4 border-t border-gray-100">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proLanding.faq.eyebrow')}</p>
          <h2
            className="text-4xl font-black text-gray-900 mb-12"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {t('proLanding.faq.headline')}
          </h2>
          <div className="divide-y divide-gray-100">
            {FAQ.map((item) => (
              <div key={item} className="py-6">
                <h3
                  className="text-lg font-black text-gray-900 mb-2"
                  style={dg}
                >
                  {t(`proLanding.faq.${item}.question`)}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{t(`proLanding.faq.${item}.answer`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="relative overflow-hidden bg-gray-950 bg-cover bg-center px-4 py-24 text-center text-white"
        style={{ backgroundImage: "url('/img/pro-ready-to-start.png')" }}
      >
        <div className="absolute inset-0 bg-gray-950/45" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/60 via-gray-950/20 to-gray-950/45" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl">
          <h2
            className="text-5xl font-black mb-5 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.03em' }}
          >
            {t('proLanding.finalCta.headline')}
          </h2>
          <p className="text-white/85 text-base mb-10 leading-relaxed">
            {t('proLanding.finalCta.body')}
          </p>
          <Link
            href="/pro/signup"
            className="inline-block bg-sky-500 text-white hover:bg-sky-600 font-semibold rounded px-9 py-3.5 text-base transition-colors"
          >
            {t('proLanding.finalCta.cta')}
          </Link>
        </div>
      </section>
    </main>
  )
}

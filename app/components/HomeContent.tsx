'use client'

import Link from 'next/link'
import Image from 'next/image'
import {
  MdVerified,
  MdPriceCheck,
  MdFlashOn,
} from 'react-icons/md'
import { useTranslations } from '@/lib/i18n/client'

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '1,200+', labelKey: 'verifiedPros' },
  { value: '550+', labelKey: 'servicesAvailable' },
  { value: '23', labelKey: 'budapestDistricts' },
  { value: '4.9★', labelKey: 'averageRating' },
] as const

type Category = { nameKey: string; image: string }

const CATEGORIES: Category[] = [
  { nameKey: 'homeImprovement', image: '/img/categories/home-improvement.jpeg' },
  { nameKey: 'events', image: '/img/categories/events.webp' },
  { nameKey: 'wellness', image: '/img/categories/wellness.webp' },
  { nameKey: 'lessons', image: '/img/categories/home-improvement.jpeg' },
  { nameKey: 'auto', image: '/img/categories/auto.webp' },
  { nameKey: 'photography', image: '/img/categories/photo.webp' },
  { nameKey: 'pets', image: '/img/categories/pets.webp' },
  { nameKey: 'business', image: '/img/categories/business.webp' },
]

const FEATURES = [
  {
    icon: MdFlashOn,
    key: 'fast',
  },
  {
    icon: MdVerified,
    key: 'verified',
  },
  {
    icon: MdPriceCheck,
    key: 'prices',
  },
] as const

const TESTIMONIALS = [
  {
    rating: 5,
    key: 'eszter',
    name: 'Eszter K.',
  },
  {
    rating: 5,
    key: 'bence',
    name: 'Bence M.',
  },
  {
    rating: 5,
    key: 'reka',
    name: 'Réka V.',
  },
]

const STEPS = [
  { number: '1', key: 'describe' },
  { number: '2', key: 'match' },
  { number: '3', key: 'book' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

const dg = { fontFamily: 'var(--font-darker-grotesque)' }

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">
      {children}
    </p>
  )
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 14 14" fill={i <= rating ? '#22c55e' : '#d1d5db'} xmlns="http://www.w3.org/2000/svg">
          <path d="M8.627 5.246L7.342 1.258a.356.356 0 00-.684 0L5.373 5.244l-4.015.049c-.346.004-.489.466-.212.682l3.222 2.513-1.197 4.018c-.103.345.272.63.553.421L7 10.494l3.276 2.435c.282.209.656-.076.553-.422L9.632 8.49l3.222-2.513c.277-.216.134-.677-.211-.682l-4.016-.048z" />
        </svg>
      ))}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomeContent() {
  const t = useTranslations()

  return (
    <>
      {/* ── Stats bar ── */}
      <section className="border-y border-gray-100 bg-gray-50 py-5">
        <dl className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {STATS.map((s) => (
            <div key={s.labelKey} className="flex flex-col items-center py-4 md:py-0 text-center px-6">
              <dt className="text-4xl font-black text-gray-900" style={dg}>{s.value}</dt>
              <dd className="text-xs text-gray-400 mt-1">{t(`home.content.stats.${s.labelKey}`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Big statement ── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <Eyebrow>{t('home.content.why.eyebrow')}</Eyebrow>
          <h2
            className="text-5xl md:text-6xl font-black text-gray-900 leading-[1.05] mb-6"
            style={{ ...dg, letterSpacing: '-0.03em' }}
          >
            {t('home.content.why.headlineLine1')}<br />{t('home.content.why.headlineLine2')}
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-lg mx-auto">
            {t('home.content.why.body')}
          </p>
          <Link
            href="/instant-results"
            className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg px-8 py-3.5 text-base transition-colors"
          >
            {t('home.content.why.cta')}
          </Link>
        </div>
      </section>

      {/* ── Feature sections ── */}
      <section className="border-t border-gray-100 px-4 py-4">
        <div className="max-w-4xl mx-auto divide-y divide-gray-100">
          {FEATURES.map((f) => (
            <div key={f.key} className="py-16 flex flex-col sm:flex-row items-start gap-10">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                <f.icon size={30} className="text-slate-800" />
              </div>
              <div>
                <h3
                  className="text-3xl font-black text-gray-900 mb-4 leading-tight"
                  style={{ ...dg, letterSpacing: '-0.02em' }}
                >
                  {t(`home.content.features.${f.key}.headline`)}
                </h3>
                <p className="text-gray-500 text-base leading-relaxed max-w-lg">{t(`home.content.features.${f.key}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <Eyebrow>{t('home.content.testimonials.eyebrow')}</Eyebrow>
          <h2 className="text-4xl font-black text-gray-900 mb-2" style={{ ...dg, letterSpacing: '-0.02em' }}>
            {t('home.content.testimonials.headline')}
          </h2>
          <p className="text-gray-500 text-base mb-10">{t('home.content.testimonials.body')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((testimonial) => (
              <div key={testimonial.name} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4 shadow-sm">
                <Stars rating={testimonial.rating} />
                <p className="text-gray-700 text-base leading-relaxed flex-1">&ldquo;{t(`home.content.testimonials.${testimonial.key}.quote`)}&rdquo;</p>
                <div className="pt-4 border-t border-gray-100">
                  <p className="font-bold text-sm text-gray-900">{testimonial.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t(`home.content.testimonials.${testimonial.key}.detail`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular services ── */}
      <section className="py-20 px-4 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <Eyebrow>{t('home.content.categories.eyebrow')}</Eyebrow>
          <h2 className="text-4xl font-black text-gray-900 mb-2" style={{ ...dg, letterSpacing: '-0.02em' }}>
            {t('home.content.categories.headline')}
          </h2>
          <p className="text-gray-500 text-base mb-10">{t('home.content.categories.body')}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const categoryName = t(`home.content.categories.${cat.nameKey}`)
              return (
              <Link
                key={cat.nameKey}
                href={`/instant-results?q=${encodeURIComponent(categoryName)}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-[18px] bg-gray-200 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <Image
                  src={cat.image}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 50vw, 220px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                <span
                  className="absolute inset-x-0 bottom-0 px-4 pb-4 text-left text-lg font-black leading-tight text-white drop-shadow-sm"
                  style={dg}
                >
                  {categoryName}
                </span>
              </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <Eyebrow>{t('home.content.steps.eyebrow')}</Eyebrow>
          <h2 className="text-4xl font-black text-gray-900 mb-2" style={{ ...dg, letterSpacing: '-0.02em' }}>
            {t('home.content.steps.headline')}
          </h2>
          <p className="text-gray-500 text-base mb-12">{t('home.content.steps.body')}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {STEPS.map((step) => (
              <div key={step.number} className="flex flex-col gap-4">
                <div
                  className="w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-black text-xl flex-shrink-0"
                  style={dg}
                >
                  {step.number}
                </div>
                <h3 className="font-black text-xl text-gray-900" style={dg}>{t(`home.content.steps.${step.key}.title`)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(`home.content.steps.${step.key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="relative overflow-hidden bg-gray-950 bg-cover bg-center px-4 py-24 text-center text-white"
        style={{ backgroundImage: "url('/img/home-bottom-hero.png')" }}
      >
        <div className="absolute inset-0 bg-gray-950/55" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/70 via-gray-950/30 to-gray-950/55" aria-hidden="true" />
        <div className="relative mx-auto max-w-xl">
          <h2
            className="text-5xl md:text-6xl font-black mb-5 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.03em' }}
          >
            {t('home.content.finalCta.headline')}
          </h2>
          <p className="text-gray-400 text-base mb-10 leading-relaxed">
            {t('home.content.finalCta.body')}
          </p>
          <Link
            href="/instant-results"
            className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-9 py-3.5 text-base transition-colors"
          >
            {t('home.content.finalCta.cta')}
          </Link>
        </div>
      </section>
    </>
  )
}

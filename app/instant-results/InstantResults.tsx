'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory, translateService } from '@/lib/i18n/taxonomy'
import servicesData from '@/public/services.json'

async function queryPros(searchQ: string, districtRoman: string | undefined): Promise<unknown[]> {
  const params = new URLSearchParams()
  if (searchQ) params.set('q', searchQ)
  if (districtRoman) params.set('district', districtRoman)

  const response = await fetch(`/api/pros?${params.toString()}`)
  if (!response.ok) throw new Error('Could not load professionals.')
  const data = await response.json()
  return (data.pros as unknown[]) ?? []
}

const RESULTS_PER_PAGE = 12

type Translator = ReturnType<typeof useTranslations>

function formatMoney(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(value)
}

// ---- Types ----

type Pro = {
  id: string
  name: string
  avatarUrl: string | null
  rating: number | null
  ratingLabel: string | null
  reviewCount: number
  isTopPro: boolean
  isOnline: boolean
  hires: number | null
  location: string
  responseTime: string
  startingPrice: number | null
  review: string
  categoryName: string
  services: string[]
  yearsExp: number | null
  availability: string[]
  workPhotoCount: number
  pastProjectCount: number
  backgroundCheck: boolean
  initials: string
  initialsColor: string
  initialsBg: string
}

type ResultsFilters = {
  minRating: number
  maxPrice: number | null
  hasReviews: boolean
  hasPrice: boolean
  hasProof: boolean
  backgroundCheck: boolean
  experienced: boolean
  categoryName: string
  serviceName: string
  sort: 'recommended' | 'rating' | 'price' | 'reviews'
}

const DEFAULT_FILTERS: ResultsFilters = {
  minRating: 0,
  maxPrice: null,
  hasReviews: false,
  hasPrice: false,
  hasProof: false,
  backgroundCheck: false,
  experienced: false,
  categoryName: '',
  serviceName: '',
  sort: 'recommended',
}

const QUALITY_FILTER_KEYS = ['hasReviews', 'hasPrice', 'hasProof', 'backgroundCheck', 'experienced'] as const

function parseNumberParam(value: string | null): number | null {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function filtersFromSearchParams(searchParams: { get(name: string): string | null }): ResultsFilters {
  const sort = searchParams.get('sort')
  return {
    minRating: parseNumberParam(searchParams.get('minRating')) ?? DEFAULT_FILTERS.minRating,
    maxPrice: parseNumberParam(searchParams.get('maxPrice')),
    hasReviews: searchParams.get('hasReviews') === '1',
    hasPrice: searchParams.get('hasPrice') === '1',
    hasProof: searchParams.get('hasProof') === '1',
    backgroundCheck: searchParams.get('backgroundCheck') === '1',
    experienced: searchParams.get('experienced') === '1',
    categoryName: searchParams.get('category') ?? '',
    serviceName: searchParams.get('service') ?? '',
    sort: sort === 'rating' || sort === 'price' || sort === 'reviews' ? sort : 'recommended',
  }
}

function writeFilterParams(params: URLSearchParams, filters: ResultsFilters): URLSearchParams {
  params.delete('minRating')
  params.delete('maxPrice')
  params.delete('category')
  params.delete('service')
  params.delete('sort')
  for (const key of QUALITY_FILTER_KEYS) params.delete(key)

  if (filters.minRating > 0) params.set('minRating', String(filters.minRating))
  if (filters.maxPrice !== null) params.set('maxPrice', String(filters.maxPrice))
  if (filters.categoryName) params.set('category', filters.categoryName)
  if (filters.serviceName) params.set('service', filters.serviceName)
  if (filters.sort !== 'recommended') params.set('sort', filters.sort)
  for (const key of QUALITY_FILTER_KEYS) {
    if (filters[key]) params.set(key, '1')
  }

  return params
}

// ---- Sub-components ----

function Stars({ rating }: { rating: number }) {
  const starPath =
    'M8.627 5.246L7.342 1.258a.356.356 0 00-.684 0L5.373 5.244l-4.015.049c-.346.004-.489.466-.212.682l3.222 2.513-1.197 4.018c-.103.345.272.63.553.421L7 10.494l3.276 2.435c.282.209.656-.076.553-.422L9.632 8.49l3.222-2.513c.277-.216.134-.677-.211-.682l-4.016-.048z'
  return (
    <span className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill={i < Math.round(rating) ? '#22c55e' : '#d1d5db'}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d={starPath} />
        </svg>
      ))}
    </span>
  )
}

function OnlineDot() {
  const t = useTranslations()
  return <span className={styles.onlinePulse} aria-label={t('instantResults.card.online')} />
}

function TopProBadge() {
  const t = useTranslations()
  return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <svg
        width="12"
        height="12"
        viewBox="0 0 14 14"
        fill="#f59e0b"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M8.627 5.246L7.342 1.258a.356.356 0 00-.684 0L5.373 5.244l-4.015.049c-.346.004-.489.466-.212.682l3.222 2.513-1.197 4.018c-.103.345.272.63.553.421L7 10.494l3.276 2.435c.282.209.656-.076.553-.422L9.632 8.49l3.222-2.513c.277-.216.134-.677-.211-.682l-4.016-.048z" />
      </svg>
      {t('instantResults.card.topPro')}
    </span>
  )
}

function ProAvatar({
  initials,
  color,
  bg,
  size,
  avatarUrl,
  square = false,
}: {
  initials: string
  color: string
  bg: string
  size: number
  avatarUrl?: string | null
  square?: boolean
}) {
  const radius = square ? 4 : '50%'
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', objectPosition: 'center', flexShrink: 0 }}
        aria-hidden="true"
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: color,
        borderRadius: radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size > 80 ? '2rem' : size > 50 ? '1.25rem' : '0.875rem',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}

function LocationIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 18"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M3.002 7.25c0 3.248 4.342 7.756 5.23 8.825l.769.925.769-.926c.888-1.068 5.234-5.553 5.234-8.824C15.004 4.145 13 1 9.001 1c-3.999 0-6 3.145-6 6.25zm1.994 0C4.995 5.135 6.175 3 9 3s4.002 2.135 4.002 4.25c0 1.777-2.177 4.248-4.002 6.59C7.1 11.4 4.996 9.021 4.996 7.25zM8.909 5.5c-.827 0-1.5.673-1.5 1.5s.673 1.5 1.5 1.5 1.5-.673 1.5-1.5-.673-1.5-1.5-1.5z" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 18"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M15.5 6.75a2.248 2.248 0 01-1.59 2.14c.053-.29.09-.585.09-.89V3.004h1.25a.25.25 0 01.25.25V6.75zM12 8c0 1.654-1.346 3-3 3S6 9.654 6 8V3h6v5zM2.5 6.75V3.246a.25.25 0 01.25-.25H4V8c0 .305.037.6.09.89A2.248 2.248 0 012.5 6.75zM15.25 1H2.75C1.785 1 1 1.785 1 2.75v4a3.75 3.75 0 003.692 3.744c.706 1.214 1.89 2.115 3.308 2.403V15H6a1 1 0 100 2h6a1 1 0 100-2h-2v-2.103c1.418-.288 2.603-1.189 3.308-2.403A3.75 3.75 0 0017 6.75v-4C17 1.785 16.215 1 15.25 1z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 18"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M7 3h3c2.205 0 4 1.794 4 4s-1.795 4-4 4H6.761l-2.76 1.401V9.642l-.198-.266A3.95 3.95 0 013 7c0-2.206 1.795-4 4-4zm.24 10H10c3.31 0 6-2.691 6-6s-2.69-6-6-6H7C3.691 1 1 3.691 1 7c0 1.17.345 2.3 1 3.288v5.371L7.24 13zm9.504-.964a1 1 0 00-1.412-.078A7.978 7.978 0 0110 14H7.957a1 1 0 100 2H10a9.98 9.98 0 006.668-2.552 1 1 0 00.076-1.412z" />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 18"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M7.5 3C5.02 3 3 5.02 3 7.5a4.49 4.49 0 001.637 3.473l.363.3v2.296l2.769-1.572.245.004H10.5c2.481 0 4.5-2.02 4.5-4.5C15 5.02 12.981 3 10.5 3h-3zM3 17.002V12.19A6.477 6.477 0 011 7.5C1 3.917 3.916 1 7.5 1h3C14.084 1 17 3.916 17 7.5c0 3.585-2.916 6.502-6.5 6.502H8.239l-5.239 3z" />
    </svg>
  )
}

function ProCard({ pro }: { pro: Pro }) {
  const t = useTranslations()
  const locale = useLocale()
  const avatarProps = { initials: pro.initials, color: pro.initialsColor, bg: pro.initialsBg, avatarUrl: pro.avatarUrl }
  return (
    <Link href={`/pro/${pro.id}`} className="block mb-2 last:mb-0 group">
      <div className="bg-white border-b border-gray-200 shadow-sm group-hover:shadow-md rounded-xl transition-shadow">
        <div className="p-3 lg:p-4">
          <div className="flex flex-wrap">

            {/* Circle avatar — fixed sizes */}
            <div className="mr-2 md:mr-3 flex-none">
              <div className="hidden md:block"><ProAvatar {...avatarProps} size={120} /></div>
              <div className="block md:hidden"><ProAvatar {...avatarProps} size={72} /></div>
            </div>

            {/* Content + price: column on mobile, row on md+ */}
            <div className="md:flex flex-1 md:justify-between md:flex-row flex-col min-w-0">

              {/* Left — name, badges, facts, review */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2">

                  {/* Name */}
                  <div>
                    <p className="text-sm md:text-base font-bold text-gray-900 leading-tight group-hover:text-slate-800 transition-colors">
                      {pro.name}
                    </p>

                    {/* Badges + rating */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                      {pro.isTopPro && <TopProBadge />}
                      {pro.rating !== null && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                            {pro.ratingLabel && `${pro.ratingLabel} `}{pro.rating.toFixed(1)}
                          </span>
                          <Stars rating={pro.rating} />
                          <span className="text-sm text-gray-400 whitespace-nowrap">({pro.reviewCount})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Facts list */}
                  <ul className="flex flex-col gap-1 text-gray-500">
                    {pro.isOnline ? (
                      <li className="text-sm flex items-start gap-1.5">
                        <OnlineDot />
                        <span>
                          {t('instantResults.card.onlineNow')} &middot; {t('instantResults.card.respondsInAbout')}{' '}
                          <strong className="text-gray-700">{pro.responseTime}</strong>
                        </span>
                      </li>
                    ) : (
                      <li className="text-sm flex items-start gap-1.5">
                        <ChatIcon />
                        <span>{t('instantResults.card.respondsInAbout')} <strong className="text-gray-700">{pro.responseTime}</strong></span>
                      </li>
                    )}
                    {pro.hires !== null && (
                      <li className="text-sm flex items-start gap-1.5">
                        <TrophyIcon />
                        <span>
                          {t(pro.hires === 1 ? 'instantResults.card.hiresSingular' : 'instantResults.card.hiresPlural', {
                            count: pro.hires.toLocaleString(locale),
                          })}
                        </span>
                      </li>
                    )}
                    <li className="text-sm flex items-start gap-1.5">
                      <LocationIcon />
                      <span>{pro.location}</span>
                    </li>
                  </ul>

                  {/* Review quote — desktop only */}
                  {pro.review && (
                    <div className="hidden md:block mt-1 cursor-pointer p-2 bg-gray-100 rounded border border-gray-200">
                      <p className={`text-sm text-gray-600 leading-relaxed ${styles.descriptionClamp}`}>
                        {pro.review}
                      </p>
                      <span className="text-sm text-slate-600 hover:underline">{t('instantResults.card.seeMore')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right — price + View profile (desktop) */}
              <div className="mt-2 md:mt-0 flex md:flex-col md:justify-between md:items-end md:pl-3 flex-shrink-0">
                <div className="flex flex-col md:items-end">
                  {pro.startingPrice !== null ? (
                    <>
                      <p className="font-bold text-base text-gray-900">{formatMoney(locale, pro.startingPrice)}</p>
                      <p className="text-sm text-gray-400">{t('instantResults.card.startingPrice')}</p>
                    </>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <ChatBubbleIcon />
                      <span className="whitespace-nowrap">{t('instantResults.card.contactForPrice')}</span>
                    </div>
                  )}
                </div>
                <div className="hidden md:block mt-2">
                  <span className="bg-slate-800 text-white rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap">
                    {t('instantResults.card.viewProfile')}
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function TopMatchBanner({ pros }: { pros: Pro[] }) {
  const t = useTranslations()
  const first3 = pros.slice(0, 3)
  if (first3.length === 0) return null

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 rounded-xl p-3 sm:p-4 mb-4 border border-slate-200">
      <div className="flex flex-row-reverse items-center">
        {first3.map((pro, i) => (
          <div
            key={pro.id}
            style={{ marginRight: i === 0 ? 0 : '-0.75rem', zIndex: first3.length - i }}
            className="border-2 border-white shadow rounded-full overflow-hidden"
          >
            <ProAvatar
              initials={pro.initials}
              color={pro.initialsColor}
              bg={pro.initialsBg}
              avatarUrl={pro.avatarUrl}
              size={48}
            />
          </div>
        ))}
      </div>
      <div className="flex-1 text-center sm:text-left">
        <p className="font-bold text-sm">{t('instantResults.topMatch.title')}</p>
        <p className="text-sm text-gray-600">
          {t('instantResults.topMatch.body')}
        </p>
      </div>
      <Link
        href={`/pro/${first3[0].id}`}
        className="bg-slate-800 text-white rounded-full px-4 py-2 text-sm font-semibold hover:bg-slate-900 w-full sm:w-auto whitespace-nowrap text-center"
      >
        {t('instantResults.topMatch.cta')}
      </Link>
    </div>
  )
}

// ---- Filter components ----

function Sidebar({
  q,
  filters,
  onChange,
  resultCount,
  averagePrice,
}: {
  q: string
  filters: ResultsFilters
  onChange: (next: ResultsFilters) => void
  resultCount: number
  averagePrice: number | null
}) {
  const t = useTranslations()
  const locale = useLocale()
  function patch(next: Partial<ResultsFilters>) {
    onChange({ ...filters, ...next })
  }

  function toggle(key: keyof Pick<ResultsFilters, 'hasReviews' | 'hasPrice' | 'hasProof' | 'backgroundCheck' | 'experienced'>) {
    patch({ [key]: !filters[key] })
  }

  const activeCount = [
    filters.minRating > 0,
    filters.maxPrice !== null,
    filters.hasReviews,
    filters.hasPrice,
    filters.hasProof,
    filters.backgroundCheck,
    filters.experienced,
    Boolean(filters.categoryName),
    Boolean(filters.serviceName),
    filters.sort !== 'recommended',
  ].filter(Boolean).length

  const minRatingOptions = [
    { label: t('instantResults.filters.rating.any'), value: 0 },
    { label: t('instantResults.filters.rating.fourFiveUp'), value: 4.5 },
    { label: t('instantResults.filters.rating.fourUp'), value: 4 },
  ]
  const priceOptions = [
    { label: t('instantResults.filters.price.any'), value: null },
    { label: t('instantResults.filters.price.upTo', { value: formatMoney(locale, 10000) }), value: 10000 },
    { label: t('instantResults.filters.price.upTo', { value: formatMoney(locale, 25000) }), value: 25000 },
    { label: t('instantResults.filters.price.upTo', { value: formatMoney(locale, 50000) }), value: 50000 },
  ]
  const qualityOptions: Array<{
    key: keyof Pick<ResultsFilters, 'hasReviews' | 'hasPrice' | 'hasProof' | 'backgroundCheck' | 'experienced'>
    label: string
  }> = [
    { key: 'hasReviews', label: t('instantResults.filters.quality.hasReviews') },
    { key: 'hasPrice', label: t('instantResults.filters.quality.hasPrice') },
    { key: 'hasProof', label: t('instantResults.filters.quality.hasProof') },
    { key: 'backgroundCheck', label: t('instantResults.filters.quality.backgroundCheck') },
    { key: 'experienced', label: t('instantResults.filters.quality.experienced') },
  ]
  const selectedCategory = servicesData.categories.find(category => category.name === filters.categoryName)
  const serviceOptions = selectedCategory
    ? selectedCategory.services
    : [...new Set(servicesData.categories.flatMap(category => category.services))].sort()

  return (
    <aside className="hidden lg:flex flex-col border-r border-gray-200" style={{ width: 288 }}>
      <div className={styles.sidebarInner}>
        <div className="bg-gray-100 rounded-lg p-3 mt-4 mx-3 border border-gray-200">
          <p className="font-bold text-sm">{q || t('instantResults.filters.servicesFallback')}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            {averagePrice
              ? formatMoney(locale, averagePrice)
              : t(resultCount === 1 ? 'instantResults.filters.prosSingular' : 'instantResults.filters.prosPlural', { count: resultCount })}
          </p>
          <p className="text-xs text-gray-500 mt-1 mb-3">
            {averagePrice ? t('instantResults.filters.averagePrice') : t('instantResults.filters.matchingActivePros')}
          </p>
          <hr className="border-gray-200" />
          <p className="text-xs text-gray-500 mt-3">
            {t(resultCount === 1 ? 'instantResults.filters.resultsAfterSingular' : 'instantResults.filters.resultsAfterPlural', { count: resultCount })}
          </p>
        </div>

        <div className="p-5 pt-4">
          <div className="mb-5">
            <p className="font-bold text-sm mb-2">{t('instantResults.filters.sortBy')}</p>
            <select
              value={filters.sort}
              onChange={e => patch({ sort: e.target.value as ResultsFilters['sort'] })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="recommended">{t('instantResults.filters.sort.recommended')}</option>
              <option value="rating">{t('instantResults.filters.sort.rating')}</option>
              <option value="reviews">{t('instantResults.filters.sort.reviews')}</option>
              <option value="price">{t('instantResults.filters.sort.price')}</option>
            </select>
          </div>

          <div className="mb-5">
            <p className="font-bold text-sm mb-2">{t('instantResults.filters.category')}</p>
            <select
              value={filters.categoryName}
              onChange={e => patch({ categoryName: e.target.value, serviceName: '' })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">{t('instantResults.filters.allCategories')}</option>
              {servicesData.categories.map(category => (
                <option key={category.name} value={category.name}>{translateCategory(t, category.name)}</option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <p className="font-bold text-sm mb-2">{t('instantResults.filters.service')}</p>
            <select
              value={filters.serviceName}
              onChange={e => patch({ serviceName: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
            >
              <option value="">{t('instantResults.filters.allServices')}</option>
              {serviceOptions.map(service => (
                <option key={service} value={service}>{translateService(t, service)}</option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <p className="font-bold text-sm mb-2">{t('instantResults.filters.minimumRating')}</p>
            {minRatingOptions.map(({ label, value }) => (
              <label key={String(value)} className={styles.radioWrap}>
                <input
                  type="radio"
                  name="min-rating"
                  checked={filters.minRating === value}
                  onChange={() => patch({ minRating: Number(value) })}
                />
                <div className={`${styles.radioCircle} ${filters.minRating === value ? styles.radioCircleSelected : ''}`} />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="mb-5">
            <p className="font-bold text-sm mb-2">{t('instantResults.filters.startingPrice')}</p>
            {priceOptions.map(({ label, value }) => (
              <label key={String(value)} className={styles.radioWrap}>
                <input
                  type="radio"
                  name="max-price"
                  checked={filters.maxPrice === value}
                  onChange={() => patch({ maxPrice: value as number | null })}
                />
                <div className={`${styles.radioCircle} ${filters.maxPrice === value ? styles.radioCircleSelected : ''}`} />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="mb-5">
            <p className="font-bold text-sm mb-2">{t('instantResults.filters.profileQuality')}</p>
            {qualityOptions.map(({ key, label }) => {
              const selected = filters[key]
              return (
                <label key={key} className={styles.radioWrap}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggle(key)}
                  />
                  <div className={`${styles.checkCircle} ${selected ? styles.checkCircleSelected : ''}`} />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-sm text-slate-600 hover:underline ml-5 mb-4 cursor-pointer bg-none border-none disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
          disabled={activeCount === 0}
        >
          {activeCount > 0
            ? t('instantResults.filters.resetWithCount', { count: activeCount })
            : t('instantResults.filters.reset')}
        </button>
      </div>
    </aside>
  )
}

// ---- API → Pro mapper ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiPro(doc: any, t: Translator): Pro {
  const name: string = doc.fullName ?? doc.name ?? t('instantResults.card.unknownPro')
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 1).toUpperCase()
  const BG_COLORS = ['#7c3aed', '#16a34a', '#1e293b', '#334155', '#15803d', '#2563eb', '#475569', '#0369a1']
  const initialsBg = BG_COLORS[name.charCodeAt(0) % BG_COLORS.length]

  const hourlyRate = doc.hourlyRate ? parseInt(doc.hourlyRate, 10) : null
  const startingPrice = !isNaN(hourlyRate ?? NaN) ? hourlyRate : null
  const yearsExp = doc.yearsExp ? parseInt(doc.yearsExp, 10) : null
  const subscriptionActive = Boolean(doc.subscriptionActive)

  return {
    id: doc.id ?? doc.uid,
    name,
    avatarUrl: (doc.avatarUrl as string | null) ?? null,
    rating: doc.rating ?? null,
    ratingLabel: doc.ratingLabel ?? null,
    reviewCount: doc.reviewCount ?? 0,
    isTopPro: subscriptionActive || Boolean(doc.isTopPro),
    isOnline: false,
    hires: doc.hires ?? null,
    location: doc.postcode ? `Budapest, ${doc.postcode}` : 'Budapest',
    responseTime: doc.responseTime ?? t('instantResults.card.defaultResponseTime'),
    startingPrice,
    review: doc.bio ?? '',
    categoryName: doc.categoryName ?? '',
    services: Array.isArray(doc.services) ? doc.services : [],
    yearsExp: !isNaN(yearsExp ?? NaN) ? yearsExp : null,
    availability: Array.isArray(doc.availability) ? doc.availability : [],
    workPhotoCount: Array.isArray(doc.workPhotoUrls) ? doc.workPhotoUrls.length : 0,
    pastProjectCount: Array.isArray(doc.pastProjects) ? doc.pastProjects.length : 0,
    backgroundCheck: Boolean(doc.backgroundCheck),
    initials,
    initialsColor: '#ffffff',
    initialsBg,
  }
}

// ---- Main export ----

export default function InstantResults({
  q,
  district,
}: {
  q: string
  district?: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams])
  const [pros, setPros] = useState<Pro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(RESULTS_PER_PAGE)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  function updateFilters(nextFilters: ResultsFilters) {
    const params = writeFilterParams(new URLSearchParams(searchParams.toString()), nextFilters)
    const queryString = params.toString()
    setVisibleCount(RESULTS_PER_PAGE)
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
  }

  useEffect(() => {
    let active = true

    async function loadPros() {
      await Promise.resolve()
      if (!active) return
      setLoading(true)
      setError(null)
      try {
        const docs = await queryPros(q, district)
        if (!active) return
        setPros(docs.map(doc => mapApiPro(doc, t)))
        setVisibleCount(RESULTS_PER_PAGE)
      } catch {
        if (!active) return
        setPros([])
        setError(t('instantResults.errors.loadBody'))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPros()
    return () => {
      active = false
    }
  }, [q, district, t])

  const filteredPros = useMemo(() => {
    const next = pros.filter(pro => {
      if (filters.categoryName && pro.categoryName !== filters.categoryName) return false
      if (filters.serviceName && !pro.services.includes(filters.serviceName)) return false
      if (filters.minRating > 0 && (!pro.rating || pro.rating < filters.minRating)) return false
      if (filters.maxPrice !== null && (pro.startingPrice === null || pro.startingPrice > filters.maxPrice)) return false
      if (filters.hasReviews && pro.reviewCount === 0) return false
      if (filters.hasPrice && pro.startingPrice === null) return false
      if (filters.hasProof && pro.workPhotoCount + pro.pastProjectCount === 0) return false
      if (filters.backgroundCheck && !pro.backgroundCheck) return false
      if (filters.experienced && (pro.yearsExp ?? 0) < 5) return false
      return true
    })
    return next.sort((a, b) => {
      if (filters.sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount
      if (filters.sort === 'reviews') return b.reviewCount - a.reviewCount || (b.rating ?? 0) - (a.rating ?? 0)
      if (filters.sort === 'price') {
        const aPrice = a.startingPrice ?? Number.MAX_SAFE_INTEGER
        const bPrice = b.startingPrice ?? Number.MAX_SAFE_INTEGER
        return aPrice - bPrice
      }
      return Number(b.isTopPro) - Number(a.isTopPro)
        || b.reviewCount - a.reviewCount
        || (b.rating ?? 0) - (a.rating ?? 0)
    })
  }, [pros, filters])

  const averagePrice = useMemo(() => {
    const priced = filteredPros
      .map(pro => pro.startingPrice)
      .filter((price): price is number => typeof price === 'number')
    if (priced.length === 0) return null
    return Math.round(priced.reduce((sum, price) => sum + price, 0) / priced.length)
  }, [filteredPros])

  const visiblePros = filteredPros.slice(0, visibleCount)
  const hasMoreResults = visibleCount < filteredPros.length
  const lastVisibleResult = Math.min(visibleCount, filteredPros.length)

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !hasMoreResults || loading || error) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisibleCount(current => Math.min(current + RESULTS_PER_PAGE, filteredPros.length))
        }
      },
      { rootMargin: '600px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMoreResults, loading, error, filteredPros.length])

  return (
    <div className="flex bg-white min-h-screen">
      <Sidebar
        q={q}
        filters={filters}
        onChange={updateFilters}
        resultCount={filteredPros.length}
        averagePrice={averagePrice}
      />
      <div className="flex-1 relative">
        <div className="px-3 py-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold">
              {q
                ? t('instantResults.header.matchingQuery', { query: q })
                : t('instantResults.header.matchingProfessionals')}
            </h2>
          </div>
          {district && (
            <p className="text-sm text-gray-500 mb-4">{t('instantResults.header.district', { district })}</p>
          )}

          {loading ? (
            <div className="flex flex-col gap-3 mt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-[108px] h-[108px] rounded-full bg-gray-100 flex-shrink-0" />
                    <div className="flex-1 space-y-3 pt-1">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <TopMatchBanner pros={filteredPros} />
              {error ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg font-semibold mb-1">{t('instantResults.errors.loadTitle')}</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : filteredPros.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg font-semibold mb-1">{t('instantResults.empty.title')}</p>
                  <p className="text-sm">{t('instantResults.empty.body')}</p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {t('instantResults.filters.showingProfessionals', {
                        shown: lastVisibleResult,
                        total: filteredPros.length,
                      })}
                    </span>
                    {hasMoreResults && <span className="font-semibold text-gray-700">{t('instantResults.filters.scrollForMore')}</span>}
                  </div>
                  {visiblePros.map(pro => (
                    <ProCard key={pro.id} pro={pro} />
                  ))}
                  <div ref={loadMoreRef} className="h-8" />
                  {hasMoreResults ? (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount(current => Math.min(current + RESULTS_PER_PAGE, filteredPros.length))}
                        className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('instantResults.filters.loadMore')}
                      </button>
                    </div>
                  ) : filteredPros.length > RESULTS_PER_PAGE ? (
                    <p className="mt-4 text-center text-sm text-gray-400">{t('instantResults.filters.allLoaded')}</p>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

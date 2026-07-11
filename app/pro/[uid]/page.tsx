'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import {
  MdAccessTime,
  MdAccountBalanceWallet,
  MdBuild,
  MdCheckCircle,
  MdHealthAndSafety,
  MdKeyboardArrowDown,
  MdLocationOn,
  MdPayments,
  MdPhoneIphone,
  MdSearch,
  MdShield,
  MdShare,
  MdStar,
  MdVerified,
  MdWorkspacePremium,
} from 'react-icons/md'
import type { IconType } from 'react-icons'
import { auth } from '@/firebase/index'
import { signUp } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { createServiceRequest, type JobLocation } from '@/firebase/serviceRequests'
import { uploadServiceRequestAttachment } from '@/firebase/storage'
import { timestampMillis } from '@/app/requests/shared'
import ReportUserButton from '@/app/components/reports/ReportUserButton'
import districtsData from '@/public/districts.json'
import {
  CATEGORY_QUESTIONS,
  MAX_ATTACHMENT_SIZE,
  MAX_PROJECT_ATTACHMENTS,
  URGENCY_OPTIONS,
} from '@/app/projects/projectQuestions'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory, translateService } from '@/lib/i18n/taxonomy'
import { compressImageFiles } from '@/lib/imageCompression'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type Translator = ReturnType<typeof useTranslations>

// ─── Types ───────────────────────────────────────────────────────────────────

type ProProfile = {
  uid: string
  fullName: string
  email?: string
  phone?: string
  phoneVerified?: boolean
  categoryId?: string
  categoryName: string
  services: string[]
  bio: string
  yearsExp: string
  pricingType: 'hourly' | 'fixed' | 'quote'
  hourlyRate: string
  availability: string[]
  socialLinks?: {
    website?: string
    facebook?: string
    instagram?: string
    linkedin?: string
    tiktok?: string
  }
  paymentMethods?: string[]
  faqs?: {
    pricing?: string
    process?: string
    advice?: string
  }
  districts: number[]
  postcode: string
  radius?: string
  avatarUrl: string | null
  workPhotoUrls: string[]
  pastProjects?: PastProject[]
  regulated: boolean
  backgroundCheck: boolean
  certificateUrl?: string | null
  insuranceUrl?: string | null
  idDocumentUrl?: string | null
  selfieUrl?: string | null
  status: string
  subscriptionActive?: boolean
  subscriptionStatus?: string
  subscriptionCurrentPeriodEnd?: { toDate?: () => Date; toMillis?: () => number } | Date | string | number | null
  rating?: number
  reviewCount?: number
}

type PastProject = {
  id: string
  jobType: string
  location: string
  duration: string
  year: string
  description: string
  beforeUrl?: string
  afterUrl?: string
}

type ProjectSummary = {
  id: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict?: string
  invitedProUids?: string[]
}

type PublicReview = {
  id: string
  requestId: string
  customerName: string
  categoryName: string
  rating: number
  comment: string
  createdAt?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOCIAL_LABELS = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
} as const

function districtName(t: Translator, id: number): string {
  return districtsData.districts.find(d => d.id === id)?.name ?? t('proProfile.common.district', { district: id })
}

function money(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(value)
}

function pricingSummary(t: Translator, locale: string, pro: ProProfile): string {
  if (pro.pricingType === 'hourly' && pro.hourlyRate) {
    return t('proProfile.pricing.hourly', { value: money(locale, Number(pro.hourlyRate)) })
  }
  if (pro.pricingType === 'fixed' && pro.hourlyRate) {
    return t('proProfile.pricing.fixed', { value: money(locale, Number(pro.hourlyRate)) })
  }
  return t('proProfile.pricing.quote')
}

function statusLabel(t: Translator, status: string): string {
  if (status === 'active') return t('proProfile.status.active')
  if (status === 'pending_verification') return t('proProfile.status.pending')
  return t('proProfile.status.review')
}

function periodEndMillis(value: ProProfile['subscriptionCurrentPeriodEnd']): number | null {
  return timestampMillis(value)
}

function hasPaidProFeatures(pro: Pick<ProProfile, 'subscriptionStatus' | 'subscriptionCurrentPeriodEnd'>): boolean {
  if (pro.subscriptionStatus === 'active') return true
  if (pro.subscriptionStatus !== 'trialing') return false
  const end = periodEndMillis(pro.subscriptionCurrentPeriodEnd)
  return end === null || end > Date.now()
}

function serviceSupportText(t: Translator, service: string, categoryName: string): string {
  const lower = service.toLowerCase()
  if (lower.includes('emergency')) return t('proProfile.serviceSupport.emergency')
  if (lower.includes('installation') || lower.includes('fitting')) return t('proProfile.serviceSupport.installation')
  if (lower.includes('repair')) return t('proProfile.serviceSupport.repair')
  if (lower.includes('clean')) return t('proProfile.serviceSupport.clean')
  if (lower.includes('design')) return t('proProfile.serviceSupport.design')
  return t('proProfile.serviceSupport.generic', { category: translateCategory(t, categoryName) })
}

function serviceIcon(service: string): IconType {
  const lower = service.toLowerCase()
  if (lower.includes('emergency') || lower.includes('repair') || lower.includes('fix')) return MdBuild
  if (lower.includes('installation') || lower.includes('fitting') || lower.includes('setup')) return MdWorkspacePremium
  if (lower.includes('clean')) return MdCheckCircle
  if (lower.includes('design') || lower.includes('planning')) return MdWorkspacePremium
  return MdBuild
}

function credentialIcon(key: string): IconType {
  if (key === 'identity') return MdVerified
  if (key === 'phone') return MdPhoneIphone
  if (key === 'background') return MdShield
  if (key === 'certificate') return MdWorkspacePremium
  if (key === 'insurance') return MdHealthAndSafety
  if (key === 'serviceArea') return MdLocationOn
  if (key === 'availability') return MdAccessTime
  if (key === 'paymentMethods') return MdPayments
  return MdAccountBalanceWallet
}

function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function socialEntries(t: Translator, pro: ProProfile) {
  return (Object.keys(SOCIAL_LABELS) as Array<keyof typeof SOCIAL_LABELS>)
    .map(key => ({ key, label: t(`proProfile.social.${key}`, { defaultValue: SOCIAL_LABELS[key] }), url: pro.socialLinks?.[key]?.trim() ?? '' }))
    .filter(item => item.url)
}

function faqEntries(t: Translator, pro: ProProfile) {
  return (['pricing', 'process', 'advice'] as const)
    .map(key => ({ key, question: t(`proProfile.faqLabels.${key}`), answer: pro.faqs?.[key]?.trim() ?? '' }))
    .filter(item => item.answer)
}

function whyThisPro(t: Translator, pro: ProProfile): string {
  const services = pro.services?.slice(0, 3).map(service => translateService(t, service)).join(', ')
  const experience = pro.yearsExp
    ? t(pro.yearsExp === '1' ? 'proProfile.why.experienceSingular' : 'proProfile.why.experiencePlural', { years: pro.yearsExp })
    : t('proProfile.why.professionalExperience')
  const serviceCopy = services ? t('proProfile.why.serviceCopy', { services: services.toLowerCase() }) : ''
  const trustCopy = hasPaidProFeatures(pro) ? t('proProfile.why.trustCopy') : ''
  return t('proProfile.why.summary', { name: pro.fullName, experience, serviceCopy, trustCopy })
}

function toApproximateJobLocation(position: GeolocationPosition): JobLocation {
  return {
    lat: Number(position.coords.latitude.toFixed(4)),
    lng: Number(position.coords.longitude.toFixed(4)),
    accuracy: Math.max(Math.ceil(position.coords.accuracy), 500),
  }
}

function optionalLocationNotice(t: Translator, err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && err.code === 1) {
    return t('proProfile.request.errors.locationSkipped')
  }
  return t('proProfile.request.errors.locationFailed')
}

function validAttachment(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

function projectSummaryTitle(t: Translator, project: ProjectSummary): string {
  return project.answers.project_details
    || project.answers.task
    || project.answers.issue
    || t('proProfile.request.projectFallback', { category: translateCategory(t, project.categoryName) })
}

function shortText(value: string, max = 72): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function optionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function translateOption(t: Translator, namespace: string, value: string): string {
  const key = optionKey(value)
  return key ? t(`${namespace}.${key}`, { defaultValue: value }) : value
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ pro, size }: { pro: ProProfile; size: number }) {
  const initials = pro.fullName.split(' ').map(n => n[0]).join('').slice(0, 1).toUpperCase()
  const BG = ['#1e293b', '#334155', '#475569', '#0f172a', '#7c3aed', '#15803d', '#2563eb', '#0369a1']
  const bg = BG[pro.fullName.charCodeAt(0) % BG.length]
  if (pro.avatarUrl) {
    return <img src={pro.avatarUrl} alt={pro.fullName} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid #f3f4f6' }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-green-600 font-bold text-sm">{rating.toFixed(1)}</span>
      <span className="flex gap-0.5">
        {[1,2,3,4,5].map(i => <MdStar key={i} size={15} color={i <= Math.round(rating) ? '#22c55e' : '#d1d5db'} />)}
      </span>
      <span className="text-sm text-gray-400">({count})</span>
    </div>
  )
}

function reviewerInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'MC'
}

function formatReviewDate(t: Translator, locale: string, value?: string): string {
  if (!value) return t('proProfile.reviews.recently')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return t('proProfile.reviews.recently')
  return parsed.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}

function ratingLabel(t: Translator, rating: number): string {
  if (rating >= 4.8) return t('proProfile.reviews.rating.exceptional')
  if (rating >= 4.5) return t('proProfile.reviews.rating.excellent')
  if (rating >= 4) return t('proProfile.reviews.rating.veryGood')
  return t('proProfile.reviews.rating.customerRated')
}

function reviewKeywords(reviews: PublicReview[]): Array<{ word: string; count: number }> {
  const stopWords = new Set([
    'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'but', 'can', 'for', 'from',
    'had', 'has', 'have', 'her', 'him', 'his', 'job', 'just', 'our', 'out', 'she', 'that', 'the',
    'their', 'them', 'then', 'they', 'this', 'was', 'were', 'with', 'work', 'would', 'you', 'your',
  ])
  const counts = new Map<string, number>()
  for (const review of reviews) {
    const words = review.comment
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g) ?? []
    for (const word of new Set(words)) {
      if (stopWords.has(word)) continue
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 10)
}

function ReviewStars({ rating, size = 18 }: { rating: number; size?: number }) {
  const t = useTranslations()
  return (
    <span className="flex gap-0.5" aria-label={t('proProfile.reviews.starsAria', { rating })}>
      {[1, 2, 3, 4, 5].map(value => (
        <MdStar key={value} size={size} color={value <= Math.round(rating) ? '#2fbf8f' : '#d1d5db'} />
      ))}
    </span>
  )
}

function ReviewSection({
  reviews,
  rating,
  reviewCount,
}: {
  reviews: PublicReview[]
  rating?: number
  reviewCount?: number
}) {
  const t = useTranslations()
  const locale = useLocale()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'relevant' | 'newest' | 'highest'>('relevant')
  const averageRating = rating ?? (reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0)
  const totalReviews = reviewCount ?? reviews.length
  const distribution = [5, 4, 3, 2, 1].map(value => {
    const count = reviews.filter(review => review.rating === value).length
    const percent = reviews.length ? Math.round((count / reviews.length) * 100) : 0
    return { value, count, percent }
  })
  const keywords = useMemo(() => reviewKeywords(reviews), [reviews])
  const filteredReviews = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matches = term
      ? reviews.filter(review =>
        review.comment.toLowerCase().includes(term)
        || review.customerName.toLowerCase().includes(term)
        || review.categoryName.toLowerCase().includes(term)
      )
      : reviews
    return [...matches].sort((a, b) => {
      if (sort === 'highest') return b.rating - a.rating
      if (sort === 'newest') return new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime()
      return b.rating - a.rating || new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime()
    })
  }, [reviews, search, sort])

  if (reviews.length === 0) {
    if (rating && reviewCount) {
      return (
        <div>
          <StarRating rating={rating} count={reviewCount} />
          <p className="mt-3 text-sm text-gray-500">
            {t('proProfile.reviews.writtenComing')}
          </p>
        </div>
      )
    }
    return (
      <div>
        <p className="text-sm text-gray-500">{t('proProfile.reviews.noneYet')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)] md:items-start">
        <div>
          <p className="text-2xl font-black leading-none text-emerald-500" style={dg}>
            {ratingLabel(t, averageRating)} {averageRating.toFixed(1)}
          </p>
          <div className="mt-3">
            <ReviewStars rating={averageRating} size={34} />
          </div>
          <p className="mt-2 text-sm font-semibold text-gray-700">
            {t(totalReviews === 1 ? 'proProfile.reviews.reviewSingular' : 'proProfile.reviews.reviewPlural', { count: totalReviews })}
          </p>
        </div>

        <div className="border-gray-100 md:border-l md:pl-7">
          <div className="flex flex-col gap-2">
            {distribution.map(item => (
              <div key={item.value} className="grid grid-cols-[34px_minmax(0,1fr)_42px] items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  {item.value} <MdStar size={13} color="#9ca3af" />
                </span>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="text-right font-semibold text-gray-700">{item.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-5 text-sm text-gray-700">
        {t('proProfile.reviews.trustCopy')}{' '}
        <Link href="/help" className="font-bold text-sky-600 hover:underline">{t('proProfile.reviews.guidelinesLink')}</Link>
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_250px]">
        <label className="relative block">
          <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={22} aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('proProfile.reviews.searchPlaceholder')}
            className="h-12 w-full rounded-sm border border-gray-300 bg-white pl-12 pr-4 text-sm text-gray-900 placeholder-gray-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
        </label>
        <label className="relative block">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="h-12 w-full appearance-none rounded-sm border border-gray-300 bg-white px-4 pr-10 text-sm text-gray-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="relevant">{t('proProfile.reviews.sort.relevant')}</option>
            <option value="newest">{t('proProfile.reviews.sort.newest')}</option>
            <option value="highest">{t('proProfile.reviews.sort.highest')}</option>
          </select>
          <MdKeyboardArrowDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-700" size={24} aria-hidden="true" />
        </label>
      </div>

      {keywords.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-gray-700">{t('proProfile.reviews.mentions')}</p>
          <div className="flex flex-wrap gap-2">
            {keywords.map(item => (
              <button
                key={item.word}
                type="button"
                onClick={() => setSearch(item.word)}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-sky-600 hover:bg-sky-50 cursor-pointer"
              >
                {item.word} · {item.count}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7 divide-y divide-gray-200 border-t border-gray-200">
        {filteredReviews.length > 0 ? filteredReviews.map(review => (
          <article key={review.id} className="py-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                {reviewerInitials(review.customerName || t('proProfile.reviews.customerFallback'))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-black text-gray-900" style={dg}>{review.customerName || t('proProfile.reviews.customerFallback')}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                      <ReviewStars rating={review.rating} size={18} />
                      <span className="font-semibold text-gray-700">{review.rating}/5</span>
                      <span>·</span>
                      <span>{review.categoryName ? translateCategory(t, review.categoryName) : t('proProfile.reviews.completedJob')}</span>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm text-gray-500">{formatReviewDate(t, locale, review.createdAt)}</p>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
                  {review.comment}
                </p>
              </div>
            </div>
          </article>
        )) : (
          <p className="py-8 text-sm text-gray-500">{t('proProfile.reviews.noMatch')}</p>
        )}
      </div>
    </div>
  )
}

function BeforeAfterViewer({
  beforeUrl,
  afterUrl,
  jobType,
}: {
  beforeUrl?: string
  afterUrl?: string
  jobType: string
}) {
  const t = useTranslations()
  const [position, setPosition] = useState(50)

  if (!beforeUrl && !afterUrl) return null
  if (!beforeUrl || !afterUrl) {
    const url = beforeUrl || afterUrl
    const label = beforeUrl ? t('proProfile.projects.before') : t('proProfile.projects.after')
    return (
      <div className="relative aspect-[4/3] bg-gray-100">
        <img src={url} alt={t('proProfile.projects.singlePhotoAlt', { jobType, label: label.toLowerCase() })} className="h-full w-full object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-700">{label}</span>
      </div>
    )
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
      <img
        src={beforeUrl}
        alt={t('proProfile.projects.beforeAlt', { jobType })}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        <img
          src={afterUrl}
          alt={t('proProfile.projects.afterAlt', { jobType })}
          className="h-full w-full object-cover"
          style={{ width: `${10000 / Math.max(position, 1)}%`, maxWidth: 'none' }}
        />
      </div>
      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${position}%` }} />
      <div className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-700">
        {t('proProfile.projects.after')}
      </div>
      <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-gray-700">
        {t('proProfile.projects.before')}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={e => setPosition(Number(e.target.value))}
        aria-label={t('proProfile.projects.compareAria', { jobType })}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
      <div
        className="pointer-events-none absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-white/95 text-xs font-black text-gray-700 shadow"
        style={{ left: `${position}%` }}
      >
        ↔
      </div>
    </div>
  )
}

function TrustAndDetails({ pro }: { pro: ProProfile }) {
  const t = useTranslations()
  const locale = useLocale()
  const topDistricts = pro.districts?.slice(0, 6) ?? []
  const moreDistricts = (pro.districts?.length ?? 0) - topDistricts.length
  const checks = [
    { key: 'identity', label: statusLabel(t, pro.status), active: pro.status === 'active' },
    { key: 'phone', label: t('proProfile.trust.phoneVerified'), active: Boolean(pro.phoneVerified) },
    { key: 'background', label: t('proProfile.trust.backgroundSubmitted'), active: Boolean(pro.backgroundCheck) },
    { key: 'certificate', label: t('proProfile.trust.certificateOnFile'), active: Boolean(pro.certificateUrl) },
    { key: 'insurance', label: t('proProfile.trust.insuranceOnFile'), active: Boolean(pro.insuranceUrl) },
  ].filter(item => item.active || item.key === 'identity')

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proProfile.details.kicker')}</p>
        <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proProfile.details.title')}</h2>
        <div className="divide-y divide-gray-100">
          {[
            [t('proProfile.details.trade'), pro.categoryName ? translateCategory(t, pro.categoryName) : t('proProfile.common.notSpecified')],
            [t('proProfile.details.experience'), pro.yearsExp ? t(pro.yearsExp === '1' ? 'proProfile.common.yearSingular' : 'proProfile.common.yearPlural', { years: pro.yearsExp }) : t('proProfile.common.notSpecified')],
            [t('proProfile.details.pricing'), pricingSummary(t, locale, pro)],
            [t('proProfile.details.paymentMethods'), pro.paymentMethods?.length ? pro.paymentMethods.join(', ') : t('proProfile.common.askBeforeBooking')],
            [t('proProfile.details.availability'), pro.availability?.length ? pro.availability.join(', ') : t('proProfile.common.askForAvailability')],
            [t('proProfile.details.homeBase'), pro.postcode ? t('proProfile.common.postcode', { postcode: pro.postcode }) : 'Budapest'],
            [t('proProfile.details.travelRadius'), pro.radius ? t('proProfile.common.distanceKm', { distance: pro.radius }) : t('proProfile.common.askForCoverage')],
          ].map(([label, value]) => (
            <div key={label} className="py-2.5 flex justify-between gap-4 text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-900 text-right">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proProfile.trust.kicker')}</p>
        <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proProfile.trust.title')}</h2>
        <div className="flex flex-col gap-2">
          {checks.map(check => (
            <div key={check.label} className="flex items-center gap-2 rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">✓</span>
              <span className="text-sm font-semibold text-gray-800">{check.label}</span>
            </div>
          ))}
        </div>
      </section>

      {topDistricts.length > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proProfile.coverage.kicker')}</p>
          <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proProfile.coverage.title')}</h2>
          <div className="flex flex-wrap gap-2">
            {topDistricts.map(id => (
              <span key={id} className="bg-gray-100 text-gray-700 text-xs font-semibold rounded-full px-3 py-1">
                {districtName(t, id)}
              </span>
            ))}
            {moreDistricts > 0 && (
              <span className="bg-slate-50 text-slate-700 text-xs font-semibold rounded-full px-3 py-1">
                {t('proProfile.coverage.more', { count: moreDistricts })}
              </span>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function RequestSignupModal({
  onClose,
  onSubmit,
  loading,
  error,
}: {
  onClose: () => void
  onSubmit: (form: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>
  loading: boolean
  error: string | null
}) {
  const t = useTranslations()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proProfile.signup.kicker')}</p>
            <h2 className="text-3xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.signup.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              {t('proProfile.signup.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label={t('proProfile.common.close')}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proProfile.signup.firstName')}
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                className="h-11 rounded border border-gray-300 px-3 text-base text-gray-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proProfile.signup.lastName')}
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                className="h-11 rounded border border-gray-300 px-3 text-base text-gray-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proProfile.signup.email')}
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="h-11 rounded border border-gray-300 px-3 text-base text-gray-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proProfile.signup.password')}
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={8}
              className="h-11 rounded border border-gray-300 px-3 text-base text-gray-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <p className="text-sm text-gray-500">
            {t('proProfile.signup.termsPrefix')}{' '}
            <Link href="/terms" target="_blank" className="text-slate-700 hover:underline">{t('proProfile.signup.terms')}</Link>{' '}
            {t('proProfile.signup.and')}{' '}
            <Link href="/privacy" target="_blank" className="text-slate-700 hover:underline">{t('proProfile.signup.privacy')}</Link>.
          </p>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
            >
              {t('proProfile.common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md border-none bg-sky-500 py-3 text-base font-bold text-white hover:bg-sky-600 disabled:opacity-50 cursor-pointer"
              style={dg}
            >
              {loading ? t('proProfile.signup.creating') : t('proProfile.signup.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EstimateWidget({ pro, ctaId }: { pro: ProProfile; ctaId?: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const questions = (CATEGORY_QUESTIONS[pro.categoryName] ?? []).filter(q => q.id !== 'urgency')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [customerDistrict, setCustomerDistrict] = useState('')
  const [projectDetails, setProjectDetails] = useState('')
  const [urgency, setUrgency] = useState('')
  const [preferredTiming, setPreferredTiming] = useState('')
  const [jobLocation, setJobLocation] = useState<JobLocation | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectSendingId, setProjectSendingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestOpen, setRequestOpen] = useState(false)
  const [signupOpen, setSignupOpen] = useState(false)
  const [signupError, setSignupError] = useState<string | null>(null)

  const hasPrice = pro.pricingType !== 'quote' && pro.hourlyRate
  const reusableProjects = projects
    .filter(project => !project.invitedProUids?.includes(pro.uid))
    .sort((a, b) => Number(b.categoryName === pro.categoryName) - Number(a.categoryName === pro.categoryName))
    .slice(0, 3)

  useEffect(() => {
    const state = { cancelled: false }
    const unsubscribe = auth.onAuthStateChanged(async user => {
      if (!user) {
        if (!state.cancelled) setProjects([])
        return
      }
      try {
        const response = await authenticatedFetch('/api/projects')
        const data = (await response.json()) as { projects?: Array<ProjectSummary & { status?: string }> }
        const nextProjects = (data.projects ?? [])
          .filter(project => project.status === 'active' && project.categoryName && project.answers.project_details)
        if (!state.cancelled) setProjects(nextProjects)
      } catch {
        if (!state.cancelled) setProjects([])
      }
    })
    return () => {
      state.cancelled = true
      unsubscribe()
    }
  }, [])

  function validateEstimate(): boolean {
    const trimmedDetails = projectDetails.trim()
    if (!trimmedDetails) {
      setError(t('proProfile.request.errors.describeWork'))
      return false
    }
    if (!customerDistrict) {
      setError(t('proProfile.request.errors.chooseDistrict'))
      return false
    }
    if (!urgency) {
      setError(t('proProfile.request.errors.chooseUrgency'))
      return false
    }
    return true
  }

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setError(null)
    if (files.some(file => !validAttachment(file))) {
      setError(t('proProfile.request.errors.fileType'))
      return
    }
    const compressedFiles = await compressImageFiles(files)
    if (compressedFiles.some(file => file.size > MAX_ATTACHMENT_SIZE)) {
      setError(t('proProfile.request.errors.fileSize'))
      return
    }
    setAttachments(prev => [...prev, ...compressedFiles].slice(0, MAX_PROJECT_ATTACHMENTS))
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  async function captureJobLocation(): Promise<JobLocation | null> {
    if (jobLocation) return jobLocation
    if (!navigator.geolocation) {
      return null
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        })
      })
      const approximateLocation = toApproximateJobLocation(position)
      setJobLocation(approximateLocation)
      return approximateLocation
    } catch (err) {
      setError(optionalLocationNotice(t, err))
      return null
    }
  }

  async function submitEstimate(user: User, location: JobLocation | null) {
    const trimmedDetails = projectDetails.trim()
    if (!validateEstimate()) {
      return
    }
    const attachmentUrls = await Promise.all(
      attachments.map(file => uploadServiceRequestAttachment(user.uid, file)),
    )

    await createServiceRequest({
      proUid: pro.uid,
      proName: pro.fullName,
      categoryName: pro.categoryName,
      answers: {
        project_details: trimmedDetails,
        urgency,
        ...answers,
        ...(preferredTiming.trim() ? { preferred_timing: preferredTiming.trim() } : {}),
      },
      customerUid: user.uid,
      customerName: user.displayName ?? '',
      customerEmail: user.email ?? '',
      customerDistrict,
      ...(location ? { jobLocation: location } : {}),
      ...(attachmentUrls.length ? { attachmentUrls } : {}),
    })
    setSubmitted(true)
    setRequestOpen(false)
  }

  async function sendExistingProject(project: ProjectSummary) {
    const user = auth.currentUser
    if (!user) {
      setError(t('proProfile.request.errors.signInExisting'))
      setRequestOpen(true)
      return
    }
    setError(null)
    setProjectSendingId(project.id)
    try {
      await createServiceRequest({
        projectId: project.id,
        proUid: pro.uid,
        proName: pro.fullName,
        categoryName: project.categoryName,
        answers: project.answers,
        customerUid: user.uid,
        customerName: user.displayName ?? '',
        customerEmail: user.email ?? '',
      })
      setProjects(prev => prev.map(item => (
        item.id === project.id
          ? { ...item, invitedProUids: [...(item.invitedProUids ?? []), pro.uid] }
          : item
      )))
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proProfile.request.errors.sendProject'))
    } finally {
      setProjectSendingId(null)
    }
  }

  async function handleSubmit() {
    setError(null)
    if (!validateEstimate()) {
      return
    }
    setSubmitting(true)
    try {
      const location = await captureJobLocation()
      const user = auth.currentUser
      if (!user) {
        setSignupError(null)
        setSignupOpen(true)
        return
      }
      await submitEstimate(user, location)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proProfile.request.errors.sendRequest'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignupAndSubmit(form: { firstName: string; lastName: string; email: string; password: string }) {
    setError(null)
    if (!validateEstimate()) {
      setSignupOpen(false)
      return
    }
    setSubmitting(true)
    setSignupError(null)
    try {
      const location = await captureJobLocation()
      const user = await signUp(form.email, form.password, form.firstName, form.lastName)
      await submitEstimate(user, location)
      setSignupOpen(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('proProfile.request.errors.createAccount')
      setSignupError(message.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-black text-gray-900 text-base mb-1" style={dg}>{t('proProfile.request.sentTitle')}</p>
        <p className="text-sm text-gray-500">
          {t('proProfile.request.sentBody', { name: pro.fullName })}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-gray-200 shadow-sm rounded-sm p-5 border-t-4 border-t-slate-800">
        {hasPrice && (
          <>
            <div className="mb-4">
              <div className="text-lg font-black text-gray-900">
                {money(locale, Number(pro.hourlyRate))}
              </div>
              <div className="text-sm text-gray-500">
                {pro.pricingType === 'hourly' ? t('proProfile.pricing.perHour') : t('proProfile.pricing.startingPrice')}
              </div>
              <button type="button" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="mt-1 text-sm font-semibold text-slate-700 hover:underline">
                {t('proProfile.request.viewDetails')}
              </button>
            </div>
            <hr className="border-gray-200 mb-4" />
          </>
        )}

        <h2 className="text-2xl font-black leading-none text-gray-900 mb-2" style={dg}>{t('proProfile.request.title')}</h2>
        <p className="text-sm leading-relaxed text-gray-500 mb-4">
          {t('proProfile.request.subtitle', { name: pro.fullName })}
        </p>

        <button
          id={ctaId}
          type="button"
          onClick={() => {
            setError(null)
            setRequestOpen(true)
          }}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black rounded-sm py-3 text-base transition-colors cursor-pointer border-none"
          style={dg}
        >
          {t('proProfile.request.cta')}
        </button>

        {reusableProjects.length > 0 && (
          <div className="mt-4 rounded-sm border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-2">
              {t('proProfile.request.existingKicker')}
            </p>
            <div className="flex flex-col gap-2">
              {reusableProjects.map(project => {
                const categoryMatch = project.categoryName === pro.categoryName
                return (
                  <div key={project.id} className="rounded-sm border border-slate-200 bg-white p-3">
                    <div className="mb-2">
                      <p className="text-sm font-bold leading-snug text-gray-900">
                        {shortText(projectSummaryTitle(t, project))}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {translateCategory(t, project.categoryName)}
                        {project.customerDistrict ? ` · ${t('proProfile.common.district', { district: project.customerDistrict })}` : ''}
                        {categoryMatch ? ` · ${t('proProfile.request.sameCategory')}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => sendExistingProject(project)}
                      disabled={projectSendingId === project.id}
                      className="w-full rounded-sm border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      {projectSendingId === project.id ? t('proProfile.request.sending') : t('proProfile.request.sendToPro')}
                    </button>
                  </div>
                )
              })}
            </div>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-gray-500">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 3h3c2.205 0 4 1.794 4 4s-1.795 4-4 4H6.761l-2.76 1.401V9.642l-.198-.266A3.95 3.95 0 013 7c0-2.206 1.795-4 4-4zm.24 10H10c3.31 0 6-2.691 6-6s-2.69-6-6-6H7C3.691 1 1 3.691 1 7c0 1.17.345 2.3 1 3.288v5.371L7.24 13zm9.504-.964a1 1 0 00-1.412-.078A7.978 7.978 0 0110 14H7.957a1 1 0 100 2H10a9.98 9.98 0 006.668-2.552 1 1 0 00.076-1.412z" />
          </svg>
          <span><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 mr-1" />{t('proProfile.request.onlineNow')}</span>
        </div>

        <hr className="border-gray-100 my-4" />
        <div className="bg-gray-50 rounded-sm p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#1e293b" opacity=".12" />
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 12l2 2 4-4" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-bold text-gray-900">{t('proProfile.request.guaranteeTitle')}</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('proProfile.request.guaranteeBody')}{' '}
            <Link href="/help#mestermind-guarantee" className="text-slate-700 hover:underline">{t('proProfile.common.learnMore')}</Link>
          </p>
        </div>
      </div>

      {requestOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4"
          onClick={() => setRequestOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white shadow-2xl overflow-y-auto"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proProfile.request.modalKicker')}</p>
                <h2 className="text-3xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.request.modalTitle', { name: pro.fullName })}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {t('proProfile.request.modalSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label={t('proProfile.common.close')}
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} className="flex flex-col gap-5 p-6">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  {t('proProfile.request.districtLabel')} <span className="text-sky-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={customerDistrict}
                    onChange={e => setCustomerDistrict(e.target.value)}
                    className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white pr-8 focus:outline-none focus:border-sky-400 transition-colors"
                  >
                    <option value="">{t('proProfile.request.selectDistrict')}</option>
                    {districtsData.districts.map(d => (
                      <option key={d.id} value={d.roman}>{d.roman}. {d.name}</option>
                    ))}
                  </select>
                  <ChevronDown />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  {t('proProfile.request.urgencyLabel')} <span className="text-sky-500">*</span>
                </label>
                <select
                  value={urgency}
                  onChange={e => setUrgency(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-sky-400 transition-colors"
                >
                  <option value="">{t('proProfile.request.selectUrgency')}</option>
                  {URGENCY_OPTIONS.map(option => (
                    <option key={option} value={option}>{translateOption(t, 'proProfile.request.urgencyOptions', option)}</option>
                  ))}
                </select>
              </div>

              {questions.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {questions.map(q => (
                    <div key={q.id}>
                      <label className="block text-sm font-bold text-gray-800 mb-1.5">{t(`proProfile.request.questions.${q.id}.label`, { defaultValue: q.label })}</label>
                      {q.type === 'select' ? (
                        <div className="relative">
                          <select
                            value={answers[q.id] ?? ''}
                            onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                            className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white pr-8 focus:outline-none focus:border-sky-400 transition-colors"
                          >
                            <option value="">{t('proProfile.request.selectAnswer')}</option>
                            {q.options?.map(o => <option key={o.value} value={o.value}>{translateOption(t, `proProfile.request.questionOptions.${q.id}`, o.label)}</option>)}
                          </select>
                          <ChevronDown />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={answers[q.id] ?? ''}
                          onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                          placeholder={q.placeholder ? t(`proProfile.request.questions.${q.id}.placeholder`, { defaultValue: q.placeholder }) : undefined}
                          className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400 transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  {t('proProfile.request.describeLabel')} <span className="text-sky-500">*</span>
                </label>
                <textarea
                  value={projectDetails}
                  onChange={e => setProjectDetails(e.target.value)}
                  placeholder={t('proProfile.request.describePlaceholder')}
                  className="w-full min-h-32 resize-y border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-sky-400 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  {t('proProfile.request.attachmentsLabel')} <span className="text-gray-400 font-normal">({t('proProfile.common.optional')})</span>
                </label>
                <div className="rounded-sm border border-dashed border-gray-300 bg-gray-50 p-4">
                  <input
                    id="request-attachments"
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="request-attachments"
                    className="block cursor-pointer rounded-sm bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 border border-gray-200 hover:bg-slate-50"
                  >
                    {t('proProfile.request.addAttachments')}
                  </label>
                  <p className="mt-2 text-xs text-gray-500">
                    {t('proProfile.request.attachmentsHint', { count: MAX_PROJECT_ATTACHMENTS })}
                  </p>
                  {attachments.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {attachments.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm">
                          <span className="truncate text-gray-700">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="shrink-0 border-none bg-transparent text-xs font-bold text-gray-400 hover:text-red-500 cursor-pointer"
                          >
                            {t('proProfile.common.remove')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">{t('proProfile.request.preferredTiming')}</label>
                <select
                  value={preferredTiming}
                  onChange={e => setPreferredTiming(e.target.value)}
                  className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-sky-400 transition-colors"
                >
                  <option value="">{t('proProfile.request.selectTiming')}</option>
                  <option value="As soon as possible">{t('proProfile.request.timing.asap')}</option>
                  <option value="Within a few days">{t('proProfile.request.timing.fewDays')}</option>
                  <option value="This week">{t('proProfile.request.timing.thisWeek')}</option>
                  <option value="Next week">{t('proProfile.request.timing.nextWeek')}</option>
                  <option value="Flexible">{t('proProfile.request.timing.flexible')}</option>
                </select>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="rounded-md border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  {t('proProfile.common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || !projectDetails.trim() || !customerDistrict || !urgency}
                  className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black rounded-md py-3 text-base transition-colors cursor-pointer disabled:cursor-not-allowed border-none"
                  style={dg}
                >
                  {submitting ? t('proProfile.request.sending') : t('proProfile.request.sendRequest')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {signupOpen && (
        <RequestSignupModal
          onClose={() => setSignupOpen(false)}
          onSubmit={handleSignupAndSubmit}
          loading={submitting}
          error={signupError}
        />
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProProfilePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params)
  const t = useTranslations()
  const [pro, setPro] = useState<ProProfile | null>(null)
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    return auth.onAuthStateChanged(user => setCurrentUid(user?.uid ?? null))
  }, [])

  useEffect(() => {
    fetch(`/api/pros/${encodeURIComponent(uid)}`)
      .then(async response => {
        if (!response.ok) {
          setNotFound(true)
          return
        }
        const data = (await response.json()) as { pro?: ProProfile | null }
        if (!data.pro) {
          setNotFound(true)
          return
        }
        setPro(data.pro)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [uid])

  useEffect(() => {
    let active = true
    fetch(`/api/pros/${uid}/reviews`)
      .then(res => res.json())
      .then(data => {
        if (active) setReviews(Array.isArray(data.reviews) ? data.reviews : [])
      })
      .catch(() => {
        if (active) setReviews([])
      })
    return () => {
      active = false
    }
  }, [uid])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse">
        <div className="flex gap-6 mb-8">
          <div className="w-28 h-28 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-7 bg-gray-100 rounded-sm w-48" />
            <div className="h-4 bg-gray-100 rounded-sm w-32" />
          </div>
        </div>
        <div className="h-24 bg-gray-100 rounded-sm mb-6" />
      </div>
    )
  }

  if (notFound || !pro) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>{t('proProfile.notFound.title')}</p>
        <p className="text-gray-500 mb-6">{t('proProfile.notFound.body')}</p>
        <Link href="/" className="inline-block bg-sky-500 text-white font-semibold rounded px-6 py-2.5 text-sm hover:bg-sky-600 transition-colors">
          {t('proProfile.notFound.back')}
        </Link>
      </div>
    )
  }

  const topDistricts = pro.districts?.slice(0, 4) ?? []
  const moreDistricts = (pro.districts?.length ?? 0) - topDistricts.length
  const isOwnProfile = currentUid === pro.uid
  const paidPro = hasPaidProFeatures(pro)
  const profileSocialLinks = socialEntries(t, pro)
  const profileFaqs = faqEntries(t, pro)
  const categoryHref = `/instant-results?q=${encodeURIComponent(pro.categoryName || '')}`
  const scrollToEstimate = () => {
    const button = document.getElementById('request-estimate-button') as HTMLButtonElement | null
    if (button) {
      button.click()
      return
    }
    document.getElementById('estimate-widget')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="min-h-screen bg-white pb-16 text-gray-900">
      <div className="mx-auto max-w-[1000px] px-4 pt-4">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-400" aria-label={t('proProfile.breadcrumb.aria')}>
          <Link href="/" className="hover:text-gray-700">Mestermind</Link>
          <span aria-hidden="true">&gt;</span>
          <Link href={categoryHref} className="hover:text-gray-700">{pro.categoryName ? translateCategory(t, pro.categoryName) : t('proProfile.breadcrumb.pros')}</Link>
          <span aria-hidden="true">&gt;</span>
          <span className="text-gray-600" aria-current="page">{pro.fullName}</span>
        </nav>

        <div className="max-w-[680px]">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Avatar pro={pro} size={104} />
            <div className="min-w-0">
              <h1 className="text-3xl font-black leading-none text-gray-900" style={dg}>{pro.fullName}</h1>
              <div className="mt-3">
                {paidPro && pro.rating && pro.reviewCount ? (
                  <StarRating rating={pro.rating} count={pro.reviewCount} />
                ) : !paidPro ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-gray-500">{t('proProfile.header.reviewsUnavailable')}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-emerald-600">{t('proProfile.header.newPro')}</span>
                    <span className="flex gap-0.5">{[1,2,3,4,5].map(i => <MdStar key={i} size={15} color="#22c55e" />)}</span>
                    <span className="text-gray-400">(0)</span>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {paidPro && <span className="inline-flex items-center gap-1 font-semibold text-slate-700"><MdVerified size={16} /> {t('proProfile.header.verifiedPro')}</span>}
                {pro.categoryName && <span>{translateCategory(t, pro.categoryName)}</span>}
                {pro.yearsExp && <span>{t(pro.yearsExp === '1' ? 'proProfile.header.yearInBusiness' : 'proProfile.header.yearsInBusiness', { years: pro.yearsExp })}</span>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const url = window.location.href
                    if (navigator.share) navigator.share({ title: pro.fullName, url })
                    else navigator.clipboard?.writeText(url)
                  }}
                  className="inline-flex items-center gap-2 rounded-sm border border-gray-300 bg-white px-6 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  <MdShare size={16} /> {t('proProfile.header.share')}
                </button>
                {!isOwnProfile && (
                  <ReportUserButton
                    targetUid={pro.uid}
                    targetRole="pro"
                    targetName={pro.fullName}
                    reporterRole="customer"
                    contextType="pro_profile"
                    buttonLabel={t('proProfile.header.report')}
                    className="inline-flex items-center rounded-sm border border-red-100 bg-white px-6 py-2 text-sm font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                  />
                )}
              </div>
            </div>
          </div>

          <nav className="mt-8 flex gap-7 overflow-x-auto border-b border-gray-200 text-sm font-semibold text-gray-500">
            {[
              ['#about', t('proProfile.nav.about')],
              ['#services', t('proProfile.nav.services')],
              ['#projects', t('proProfile.nav.projects')],
              ['#reviews', t('proProfile.nav.reviews')],
              ['#credentials', t('proProfile.nav.credentials')],
              ['#faqs', t('proProfile.nav.faqs')],
            ].map(([href, label]) => (
              <a key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent pb-4 hover:border-slate-800 hover:text-gray-900">
                {label}
              </a>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 gap-10 py-7 lg:grid-cols-[minmax(0,680px)_280px] lg:items-start">
          <div className="flex flex-col gap-8">
            <section className="rounded-sm bg-gray-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xl">✧</span>
                <h2 className="text-base font-black text-gray-900">{t('proProfile.why.title')}</h2>
              </div>
              <p className="text-sm leading-relaxed text-gray-600">{whyThisPro(t, pro)}</p>
              <p className="mt-3 text-xs text-gray-400">{t('proProfile.why.disclaimer')}</p>
            </section>

            <section id="about" className="scroll-mt-6">
              <h2 className="mb-3 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.nav.about')}</h2>
              {pro.bio ? (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">{pro.bio}</p>
              ) : (
                <p className="text-sm leading-relaxed text-gray-500">{t('proProfile.about.empty', { name: pro.fullName })}</p>
              )}
            </section>

            <section id="services" className="scroll-mt-6">
              <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.nav.services')}</h2>
              {pro.services?.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {pro.services.map(s => {
                    const Icon = serviceIcon(s)
                    return (
                      <div key={s} className="rounded-sm border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-700">
                          <Icon size={20} aria-hidden="true" />
                        </div>
                        <p className="font-bold text-gray-900">{translateService(t, s)}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500">{serviceSupportText(t, s, pro.categoryName)}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('proProfile.services.empty')}</p>
              )}
            </section>

            <section id="projects" className="scroll-mt-6">
              <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.nav.projects')}</h2>
              {pro.pastProjects?.length ? (
                <div className="grid grid-cols-1 gap-5">
                  {pro.pastProjects.map(project => (
                    <article key={project.id} className="overflow-hidden rounded-sm border border-gray-200 bg-white">
                      {(project.beforeUrl || project.afterUrl) && (
                        <BeforeAfterViewer
                          beforeUrl={project.beforeUrl}
                          afterUrl={project.afterUrl}
                          jobType={project.jobType}
                        />
                      )}
                      <div className="p-4">
                        <h3 className="font-black text-gray-900">{project.jobType}</h3>
                        <p className="mt-1 text-sm font-semibold text-gray-500">
                          {project.location} · {project.duration} · {project.year}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-gray-600">{project.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : pro.workPhotoUrls?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {pro.workPhotoUrls.map((url, i) => (
                      <div key={i} className="aspect-square overflow-hidden rounded-sm border border-gray-100">
                        <img src={url} alt={t('proProfile.projects.workSampleAlt', { index: i + 1 })} className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">{t('proProfile.projects.empty', { name: pro.fullName })}</p>
                )}
            </section>

            <section id="reviews" className="scroll-mt-6">
              <h2 className="mb-3 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.nav.reviews')}</h2>
              {paidPro ? (
                <ReviewSection reviews={reviews} rating={pro.rating} reviewCount={pro.reviewCount} />
              ) : (
                <p className="text-sm text-gray-500">{t('proProfile.reviews.proOnly')}</p>
              )}
            </section>

            <section id="credentials" className="scroll-mt-6">
              <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.nav.credentials')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ['identity', t('proProfile.credentials.identity'), pro.status === 'active' ? t('proProfile.credentials.verified') : statusLabel(t, pro.status)],
                  ['phone', t('proProfile.credentials.phone'), pro.phoneVerified ? t('proProfile.credentials.verified') : t('proProfile.credentials.pending')],
                  ['background', t('proProfile.credentials.background'), pro.backgroundCheck ? t('proProfile.credentials.submitted') : t('proProfile.credentials.notRequested')],
                  ['certificate', t('proProfile.credentials.certificate'), pro.certificateUrl ? t('proProfile.credentials.onFile') : pro.regulated ? t('proProfile.credentials.requested') : t('proProfile.credentials.notRequired')],
                  ['insurance', t('proProfile.credentials.insurance'), pro.insuranceUrl ? t('proProfile.credentials.onFile') : t('proProfile.credentials.notListed')],
                  ['serviceArea', t('proProfile.credentials.serviceArea'), topDistricts.length ? `${topDistricts.map(id => districtName(t, id)).join(', ')}${moreDistricts > 0 ? ` ${t('proProfile.coverage.more', { count: moreDistricts })}` : ''}` : 'Budapest'],
                  ['availability', t('proProfile.credentials.availability'), pro.availability?.length ? pro.availability.join(', ') : t('proProfile.common.askForAvailability')],
                  ['paymentMethods', t('proProfile.credentials.paymentMethods'), pro.paymentMethods?.length ? pro.paymentMethods.join(', ') : t('proProfile.common.askBeforeBooking')],
                ].map(([key, label, value]) => {
                  const Icon = credentialIcon(key)
                  return (
                    <div key={label} className="rounded-sm border border-gray-200 bg-white p-4 text-sm">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-700">
                        <Icon size={20} aria-hidden="true" />
                      </div>
                      <p className="text-gray-400">{label}</p>
                      <p className="mt-1 font-bold text-gray-900">{value}</p>
                    </div>
                  )
                })}
              </div>
              {profileSocialLinks.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {profileSocialLinks.map(link => (
                    <a key={link.key} href={externalHref(link.url)} target="_blank" rel="noreferrer" className="rounded-sm border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-gray-50">
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </section>

            <section id="faqs" className="scroll-mt-6">
              <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proProfile.nav.faqs')}</h2>
              {profileFaqs.length > 0 ? (
                <div className="divide-y divide-gray-200 border-y border-gray-200">
                  {profileFaqs.map(item => (
                    <div key={item.key} className="py-5">
                      <h3 className="font-bold text-gray-900">{item.question}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-3 text-sm text-gray-600 sm:grid-cols-2">
                  {[
                    t('proProfile.faqFallback.included'),
                    t('proProfile.faqFallback.materials'),
                    t('proProfile.faqFallback.preparation'),
                    t('proProfile.faqFallback.pastWork'),
                  ].map(item => (
                    <li key={item} className="rounded-sm bg-gray-50 p-3">{item}</li>
                  ))}
                </ul>
              )}
            </section>

            {!isOwnProfile && (
              <section id="estimate-widget" className="lg:hidden scroll-mt-6">
                <EstimateWidget pro={pro} ctaId="request-estimate-button" />
              </section>
            )}
          </div>

          <aside className="hidden lg:sticky lg:top-5 lg:block">
            <EstimateWidget pro={pro} />
          </aside>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 flex gap-2 border-t border-gray-200 bg-white p-3 lg:hidden">
        {isOwnProfile ? (
          <Link href="/pro/jobs" className="flex-1 rounded-sm bg-sky-500 py-3 text-center text-sm font-bold text-white hover:bg-sky-600" style={dg}>
            {t('proProfile.mobile.dashboard')}
          </Link>
        ) : (
          <button type="button" onClick={scrollToEstimate} className="flex-1 rounded-sm bg-sky-500 py-3 text-sm font-bold text-white hover:bg-sky-600" style={dg}>
            {t('proProfile.request.cta')}
          </button>
        )}
      </div>
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/firebase/apiClient'
import { timestampMillis, type TimestampLike } from '@/app/requests/shared'
import { translateQuoteTimeline } from '@/app/pro/jobs/JobModals'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type Translator = ReturnType<typeof useTranslations>

type RequestDoc = {
  id: string
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  categoryName?: string
  customerName?: string
  quote?: { price?: string; timeline?: string }
  acceptance?: { acceptedAt?: TimestampLike | null }
  createdAt?: TimestampLike | null
  completedAt?: TimestampLike | null
  obfuscated?: boolean
}

type EarningsJob = RequestDoc & {
  amount: number
}

type MonthBucket = {
  key: string
  label: string
  actual: number
  expected: number
}

function quoteAmount(price?: string): number {
  if (!price) return 0
  const lower = price.toLowerCase()
  const multiplier = /\b(k|ezer)\b/.test(lower) ? 1000 : 1
  const matches = lower.match(/\d[\d\s,.]*/g) ?? []
  const amounts = matches
    .map(match => Number(match.replace(/[^\d]/g, '')))
    .filter(Number.isFinite)
  if (amounts.length === 0) return 0
  return Math.max(...amounts) * multiplier
}

function money(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(value)
}

function pct(value: number): string {
  return `${Math.round(value)}%`
}

function jobDate(req: RequestDoc): number {
  return timestampMillis(req.completedAt) ?? timestampMillis(req.acceptance?.acceptedAt) ?? timestampMillis(req.createdAt) ?? Date.now()
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(locale: string, date: Date): string {
  return date.toLocaleDateString(locale, { month: 'short' })
}

function buildMonthlyBuckets(locale: string, completed: EarningsJob[], active: EarningsJob[]): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    return { key: monthKey(date), label: monthLabel(locale, date), actual: 0, expected: 0 }
  })
  const byKey = new Map(buckets.map(bucket => [bucket.key, bucket]))

  for (const req of completed) {
    const bucket = byKey.get(monthKey(new Date(jobDate(req))))
    if (bucket) bucket.actual += req.amount
  }
  for (const req of active) {
    const bucket = byKey.get(monthKey(new Date(jobDate(req))))
    if (bucket) bucket.expected += req.amount
  }

  return buckets
}

function relativeTime(t: Translator, ts: TimestampLike | null | undefined): string {
  const millis = timestampMillis(ts)
  if (!millis) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return t('proEarnings.time.justNow')
  if (seconds < 3600) return t('proEarnings.time.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('proEarnings.time.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('proEarnings.time.daysAgo', { count: Math.floor(seconds / 86400) })
}

function MetricCard({
  label,
  value,
  body,
  tone = 'default',
}: {
  label: string
  value: string
  body: string
  tone?: 'default' | 'orange' | 'dark'
}) {
  const toneClass = tone === 'orange'
    ? 'border-slate-200 bg-slate-50'
    : tone === 'dark'
      ? 'border-slate-800 bg-slate-800 text-white'
      : 'border-gray-200 bg-white'

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <p className={`mb-2 text-xs font-bold uppercase tracking-widest ${tone === 'dark' ? 'text-slate-300' : tone === 'orange' ? 'text-slate-700' : 'text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-4xl font-black ${tone === 'dark' ? 'text-white' : 'text-gray-900'}`} style={dg}>{value}</p>
      <p className={`mt-2 text-sm ${tone === 'dark' ? 'text-slate-300' : tone === 'orange' ? 'text-slate-600' : 'text-gray-500'}`}>{body}</p>
    </div>
  )
}

function EarningsChart({ buckets }: { buckets: MonthBucket[] }) {
  const t = useTranslations()
  const locale = useLocale()
  const maxValue = Math.max(1, ...buckets.flatMap(bucket => [bucket.actual, bucket.expected]))

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proEarnings.chart.kicker')}</p>
          <h2 className="text-2xl font-black leading-none text-gray-900" style={dg}>{t('proEarnings.chart.title')}</h2>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-slate-700"><span className="h-2.5 w-2.5 rounded-full bg-slate-800" /> {t('proEarnings.chart.real')}</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> {t('proEarnings.chart.expected')}</span>
        </div>
      </div>

      <div className="flex h-64 items-end gap-3 border-b border-gray-100 pb-3">
        {buckets.map(bucket => {
          const actualHeight = Math.max(4, (bucket.actual / maxValue) * 100)
          const expectedHeight = Math.max(4, (bucket.expected / maxValue) * 100)
          return (
            <div key={bucket.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-48 w-full items-end justify-center gap-1.5">
                <div
                  className="w-5 rounded-t-lg bg-slate-800"
                  style={{ height: `${actualHeight}%` }}
                  title={t('proEarnings.chart.realTooltip', { month: bucket.label, value: money(locale, bucket.actual) })}
                />
                <div
                  className="w-5 rounded-t-lg bg-slate-300"
                  style={{ height: `${expectedHeight}%` }}
                  title={t('proEarnings.chart.expectedTooltip', { month: bucket.label, value: money(locale, bucket.expected) })}
                />
              </div>
              <span className="text-xs font-semibold text-gray-400">{bucket.label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {buckets.slice(-3).map(bucket => (
          <div key={bucket.key} className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs font-bold text-gray-400">{bucket.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{money(locale, bucket.actual)}</p>
            <p className="text-xs text-slate-500">{t('proEarnings.chart.expectedAddition', { value: money(locale, bucket.expected) })}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function JobList({ title, jobs, empty }: { title: string; jobs: EarningsJob[]; empty: string }) {
  const t = useTranslations()
  const locale = useLocale()
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{title}</h2>
      {jobs.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {jobs.map(req => (
            <Link key={req.id} href={`/pro/jobs/${req.id}`} className="block py-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{req.categoryName ? translateCategory(t, req.categoryName) : t('proEarnings.jobList.serviceJob')}</p>
                  <p className="text-sm text-gray-500">
                    {req.customerName ?? t('proEarnings.jobList.customer')}
                    {req.createdAt ? ` · ${relativeTime(t, req.createdAt)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-900">{req.amount > 0 ? money(locale, req.amount) : req.quote?.price ?? t('proEarnings.jobList.quoteOnRequest')}</p>
                  {req.quote?.timeline && <p className="text-xs text-gray-400">{translateQuoteTimeline(t, req.quote.timeline)}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{empty}</p>
      )}
    </section>
  )
}

export default function ProEarningsPage() {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  const [requests, setRequests] = useState<RequestDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authenticatedFetch('/api/pro/service-requests')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const nextRequests = Array.isArray(data.requests) ? data.requests as RequestDoc[] : []
        setRequests(nextRequests.filter(request => !request.obfuscated))
      })
      .catch(() => {
        if (!active) return
        setRequests([])
        router.replace('/login?next=/pro/earnings')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [router])

  const valuedRequests: EarningsJob[] = requests.map(req => ({ ...req, amount: quoteAmount(req.quote?.price) }))
  const completed = valuedRequests.filter(req => req.status === 'completed')
  const active = valuedRequests.filter(req => req.status === 'accepted')
  const quoted = valuedRequests.filter(req => req.status === 'quoted')
  const completedTotal = completed.reduce((sum, req) => sum + req.amount, 0)
  const expectedTotal = active.reduce((sum, req) => sum + req.amount, 0)
  const quotedPipeline = quoted.reduce((sum, req) => sum + req.amount, 0)
  const totalAcceptedOrCompleted = active.length + completed.length
  const realisationRate = totalAcceptedOrCompleted > 0 ? (completed.length / totalAcceptedOrCompleted) * 100 : 0
  const averageCompleted = completed.length > 0 ? completedTotal / completed.length : 0
  const buckets = buildMonthlyBuckets(locale, completed, active)
  const recentCompleted = [...completed].sort((a, b) => jobDate(b) - jobDate(a)).slice(0, 6)
  const upcoming = [...active].sort((a, b) => jobDate(b) - jobDate(a)).slice(0, 6)

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proEarnings.header.kicker')}</p>
        <h1 className="text-5xl font-black text-gray-900 leading-[1.05]" style={{ ...dg, letterSpacing: '-0.02em' }}>
          {t('proEarnings.header.title')}
        </h1>
        <p className="text-gray-500 text-base mt-2 mb-8">
          {t('proEarnings.header.subtitle')}
        </p>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map(item => (
              <div key={item} className="h-36 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={t('proEarnings.metrics.real.label')}
                value={money(locale, completedTotal)}
                body={t(completed.length === 1 ? 'proEarnings.metrics.real.bodySingular' : 'proEarnings.metrics.real.bodyPlural', { count: completed.length })}
                tone="dark"
              />
              <MetricCard
                label={t('proEarnings.metrics.expected.label')}
                value={money(locale, expectedTotal)}
                body={t(active.length === 1 ? 'proEarnings.metrics.expected.bodySingular' : 'proEarnings.metrics.expected.bodyPlural', { count: active.length })}
                tone="orange"
              />
              <MetricCard
                label={t('proEarnings.metrics.pipeline.label')}
                value={money(locale, quotedPipeline)}
                body={t(quoted.length === 1 ? 'proEarnings.metrics.pipeline.bodySingular' : 'proEarnings.metrics.pipeline.bodyPlural', { count: quoted.length })}
              />
              <MetricCard
                label={t('proEarnings.metrics.average.label')}
                value={averageCompleted > 0 ? money(locale, averageCompleted) : t('proEarnings.metrics.average.notAvailable')}
                body={t('proEarnings.metrics.average.body', { rate: pct(realisationRate) })}
              />
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <EarningsChart buckets={buckets} />
              </div>
              <aside className="flex flex-col gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proEarnings.forecast.kicker')}</p>
                  <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proEarnings.forecast.title')}</h2>
                  <div className="divide-y divide-gray-100">
                    {[
                      [t('proEarnings.forecast.booked'), money(locale, expectedTotal)],
                      [t('proEarnings.forecast.openQuote'), money(locale, quotedPipeline)],
                      [t('proEarnings.forecast.projectedTotal'), money(locale, completedTotal + expectedTotal + quotedPipeline)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-bold text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="mb-1 text-sm font-bold text-slate-800">
                    {t(active.length === 1 ? 'proEarnings.activeJobs.singular' : 'proEarnings.activeJobs.plural', { count: active.length })}
                  </p>
                  <p className="text-sm leading-6 text-slate-600">{t('proEarnings.activeJobs.body')}</p>
                </div>
              </aside>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <JobList
                title={t('proEarnings.jobList.recentTitle')}
                jobs={recentCompleted}
                empty={t('proEarnings.jobList.recentEmpty')}
              />
              <JobList
                title={t('proEarnings.jobList.expectedTitle')}
                jobs={upcoming}
                empty={t('proEarnings.jobList.expectedEmpty')}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

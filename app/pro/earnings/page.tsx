'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/firebase/apiClient'
import { timestampMillis, timeAgo, type TimestampLike } from '@/app/requests/shared'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

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

function money(value: number): string {
  return new Intl.NumberFormat('hu-HU', {
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

function monthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' })
}

function buildMonthlyBuckets(completed: EarningsJob[], active: EarningsJob[]): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    return { key: monthKey(date), label: monthLabel(date), actual: 0, expected: 0 }
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
  const maxValue = Math.max(1, ...buckets.flatMap(bucket => [bucket.actual, bucket.expected]))

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-700">Trend</p>
          <h2 className="text-2xl font-black leading-none text-gray-900" style={dg}>Expected vs real earnings</h2>
        </div>
        <div className="flex gap-3 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-slate-700"><span className="h-2.5 w-2.5 rounded-full bg-slate-800" /> Real</span>
          <span className="inline-flex items-center gap-1.5 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Expected</span>
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
                  title={`${bucket.label} real: ${money(bucket.actual)}`}
                />
                <div
                  className="w-5 rounded-t-lg bg-slate-300"
                  style={{ height: `${expectedHeight}%` }}
                  title={`${bucket.label} expected: ${money(bucket.expected)}`}
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
            <p className="mt-1 text-sm font-bold text-slate-800">{money(bucket.actual)}</p>
            <p className="text-xs text-slate-500">+ {money(bucket.expected)} expected</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function JobList({ title, jobs, empty }: { title: string; jobs: EarningsJob[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{title}</h2>
      {jobs.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {jobs.map(req => (
            <Link key={req.id} href={`/pro/jobs/${req.id}`} className="block py-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{req.categoryName ?? 'Service job'}</p>
                  <p className="text-sm text-gray-500">
                    {req.customerName ?? 'Customer'}
                    {req.createdAt ? ` · ${timeAgo(req.createdAt)}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-gray-900">{req.amount > 0 ? money(req.amount) : req.quote?.price ?? 'Quote on request'}</p>
                  {req.quote?.timeline && <p className="text-xs text-gray-400">{req.quote.timeline}</p>}
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
  const buckets = buildMonthlyBuckets(completed, active)
  const recentCompleted = [...completed].sort((a, b) => jobDate(b) - jobDate(a)).slice(0, 6)
  const upcoming = [...active].sort((a, b) => jobDate(b) - jobDate(a)).slice(0, 6)

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">Pro dashboard</p>
        <h1 className="text-5xl font-black text-gray-900 leading-[1.05]" style={{ ...dg, letterSpacing: '-0.02em' }}>
          Earnings
        </h1>
        <p className="text-gray-500 text-base mt-2 mb-8">
          Track real revenue from completed jobs, expected revenue from accepted work, and quote pipeline value.
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
                label="Real earnings"
                value={money(completedTotal)}
                body={`${completed.length} completed job${completed.length === 1 ? '' : 's'}`}
                tone="dark"
              />
              <MetricCard
                label="Expected earnings"
                value={money(expectedTotal)}
                body={`${active.length} accepted job${active.length === 1 ? '' : 's'} still in progress`}
                tone="orange"
              />
              <MetricCard
                label="Quote pipeline"
                value={money(quotedPipeline)}
                body={`${quoted.length} quote${quoted.length === 1 ? '' : 's'} waiting on customers`}
              />
              <MetricCard
                label="Avg completed job"
                value={averageCompleted > 0 ? money(averageCompleted) : 'n/a'}
                body={`${pct(realisationRate)} of accepted/completed jobs are completed`}
              />
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <EarningsChart buckets={buckets} />
              </div>
              <aside className="flex flex-col gap-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-700">Forecast</p>
                  <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>What is coming</h2>
                  <div className="divide-y divide-gray-100">
                    {[
                      ['Booked but not complete', money(expectedTotal)],
                      ['Open quote value', money(quotedPipeline)],
                      ['Projected total', money(completedTotal + expectedTotal + quotedPipeline)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-bold text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="mb-1 text-sm font-bold text-slate-800">{active.length} active job{active.length === 1 ? '' : 's'}</p>
                  <p className="text-sm leading-6 text-slate-600">Mark finished work complete, then customers can confirm it and move the value into real earnings.</p>
                </div>
              </aside>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <JobList
                title="Recent real earnings"
                jobs={recentCompleted}
                empty="Completed jobs will appear here after customers confirm the work."
              />
              <JobList
                title="Expected earnings"
                jobs={upcoming}
                empty="Accepted jobs will appear here before they are completed."
              />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

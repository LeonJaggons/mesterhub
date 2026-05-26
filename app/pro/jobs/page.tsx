'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/firebase/apiClient'
import { declineServiceRequestAsPro, quoteServiceRequest } from '@/firebase/serviceRequests'
import { QuoteModal, DeclineModal, type QuoteFormData } from './JobModals'
import { approximateLocationLabel } from '@/app/requests/shared'
import type { JobLocation } from '@/firebase/serviceRequests'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
import { inquiryCreatedAtMillis, inquiryMonthKey, type InquiryTimestamp } from '@/lib/inquiryAccess'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type RequestStatus = 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'

type Quote = { price: string; timeline: string; notes: string }

type AcceptanceDetails = {
  phone?: string
  address?: string
  preferredStart?: string
}

type ServiceRequest = {
  id: string
  projectId?: string
  proUid: string
  categoryName: string
  answers: Record<string, string>
  customerUid: string
  customerName: string
  customerEmail: string
  customerDistrict?: string
  jobLocation?: JobLocation
  status: RequestStatus
  quote?: Quote
  acceptance?: AcceptanceDetails
  createdAt: InquiryTimestamp
  obfuscated?: boolean
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'New request',
  quoted: 'Quote sent',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  quoted: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-green-50 text-green-700 border-green-200',
  declined: 'bg-gray-100 text-gray-500 border-gray-200',
  completed: 'bg-slate-800 text-white border-slate-800',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

function timeAgo(ts: InquiryTimestamp): string {
  if (!ts) return ''
  const seconds = Math.floor((Date.now() - inquiryCreatedAtMillis(ts)) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatAnswers(answers: Record<string, string>): Array<{ key: string; value: string }> {
  return Object.entries(answers)
    .filter(([, v]) => v)
    .map(([k, v]) => ({
      key: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }))
}

function districtCopy(req: ServiceRequest): string {
  if (req.jobLocation) return approximateLocationLabel(req.jobLocation)
  return req.customerDistrict ? `District ${req.customerDistrict}` : 'District not shared'
}

function customerDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Customer'
  const [first, ...rest] = parts
  const lastInitial = rest.at(-1)?.[0]
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first
}

function newestRequestLabel(requests: ServiceRequest[]): string {
  const newest = requests[0]
  if (!newest) return 'No requests yet'
  return `${newest.categoryName} - ${timeAgo(newest.createdAt) || 'just now'}`
}

function acceptedContactCount(requests: ServiceRequest[]): number {
  return requests.filter(r => r.status === 'accepted' && (r.acceptance?.phone || r.customerEmail)).length
}

function monthlyResetLabel(reference = new Date()): string {
  const resetDate = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  return resetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function hiddenInquiryCopy(resetLabel: string): string {
  return `New inquiries are waiting with details hidden. Upgrade to unlock every request now, or your free views refresh on ${resetLabel}.`
}

function topCategories(requests: ServiceRequest[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  requests.forEach(req => counts.set(req.categoryName, (counts.get(req.categoryName) ?? 0) + 1))
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

function JobCard({
  req,
  onAccept,
  onDecline,
}: {
  req: ServiceRequest
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}) {
  const details = formatAnswers(req.answers)
  const isPending = req.status === 'pending'
  const isAccepted = req.status === 'accepted'
  const isQuoted = req.status === 'quoted'
  const customerName = customerDisplayName(req.customerName)
  const card = (
    <div className={`bg-white rounded-2xl border shadow-sm transition-shadow ${isPending ? 'border-orange-200' : isQuoted ? 'border-blue-200' : 'border-gray-200 group-hover:shadow-md'}`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: '#f97316' }}
              >
                {customerName[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="font-bold text-gray-900 text-sm">
                {customerName}
              </span>
            </div>
            <p className="text-xs text-gray-400 ml-10">
              {req.categoryName} · {timeAgo(req.createdAt)}
            </p>
            <p className="text-xs text-gray-400 ml-10">
              {districtCopy(req)}
            </p>
          </div>
          <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 flex-shrink-0 ${STATUS_COLORS[req.status]}`}>
            {STATUS_LABELS[req.status]}
          </span>
        </div>

        {/* Question answers */}
        {details.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-3 mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {details.map(d => (
              <div key={d.key} className="text-sm">
                <span className="text-gray-400">{d.key}: </span>
                <span className="text-gray-800 font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quote summary */}
        {isQuoted && req.quote && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-3 flex items-center gap-3 text-sm">
            <span className="text-blue-600 font-bold">{req.quote.price}</span>
            <span className="text-blue-400">·</span>
            <span className="text-blue-600">{req.quote.timeline}</span>
          </div>
        )}

        {/* Contact info — only visible after accepting */}
        {isAccepted && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 mb-3 flex flex-col gap-1">
            <p className="text-xs font-bold text-green-700 mb-1">Contact details</p>
            <p className="text-sm text-gray-700">{req.customerName}</p>
            <p className="text-sm text-orange-500">{req.customerEmail}</p>
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex gap-2 mt-1">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAccept(req.id) }}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg py-2.5 text-sm transition-colors cursor-pointer border-none"
              style={dg}
            >
              Send quote
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDecline(req.id) }}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-lg text-sm transition-colors cursor-pointer bg-white"
            >
              Decline
            </button>
          </div>
        )}

        {req.status === 'declined' && (
          <p className="text-xs text-gray-400 mt-1">You declined this request.</p>
        )}
        {req.status === 'cancelled' && (
          <p className="text-xs text-gray-400 mt-1">This request was cancelled.</p>
        )}
        {req.status === 'completed' && (
          <p className="text-xs text-green-700 mt-1">Customer confirmed completion.</p>
        )}
      </div>
    </div>
  )

  return <Link href={`/pro/jobs/${req.id}`} className="block group">{card}</Link>
}

function HiddenInquiryUpgradeCard({ resetLabel }: { resetLabel: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
      <div className="relative border-b border-orange-100 bg-orange-50 p-5">
        <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-300/80" />
            <div className="h-4 w-36 rounded bg-slate-300/80" />
          </div>
          <div className="mb-2 h-4 w-4/5 rounded bg-slate-300/70" />
          <div className="h-4 w-2/3 rounded bg-slate-300/60" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-center bg-orange-50/80 px-5">
          <p className="text-sm font-bold text-gray-900">More inquiries are waiting</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            Details are hidden after your monthly free clear views are used.
          </p>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm leading-relaxed text-gray-600">
          Upgrade to Mestermind Pro to unlock every new request immediately, or wait until {resetLabel} when your free views refresh.
        </p>
        <Link
          href="/pro/settings"
          className="mt-4 block rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-orange-600"
          style={dg}
        >
          Unlock new inquiries
        </Link>
      </div>
    </div>
  )
}

type Tab = 'all' | RequestStatus

export default function JobsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [hasProPlan, setHasProPlan] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [quoteModalId, setQuoteModalId] = useState<string | null>(null)
  const [declineModalId, setDeclineModalId] = useState<string | null>(null)

  // Auth guard + load requests
  useEffect(() => {
    let active = true
    authenticatedFetch('/api/pro/service-requests')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const nextRequests = Array.isArray(data.requests) ? data.requests as ServiceRequest[] : []
        setRequests(nextRequests)
        setHasProPlan(Boolean(data.access?.hasProPlan))
      })
      .catch(() => {
        if (!active) return
        setRequests([])
        setHasProPlan(false)
        router.push('/login')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [router])

  async function handleQuoteSubmit(id: string, data: QuoteFormData) {
    await quoteServiceRequest(id, data)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'quoted', quote: data } : r))
    setQuoteModalId(null)
  }

  async function handleDeclineConfirm(id: string) {
    await declineServiceRequestAsPro(id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'declined' } : r))
    setDeclineModalId(null)
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const quotedCount = requests.filter(r => r.status === 'quoted').length
  const acceptedCount = requests.filter(r => r.status === 'accepted').length
  const visibleRequests = requests.filter(req => !req.obfuscated)
  const filtered = tab === 'all' ? visibleRequests : visibleRequests.filter(r => r.status === tab)
  const currentMonthKey = inquiryMonthKey(new Date())
  const currentMonthRequests = requests.filter(req => inquiryMonthKey(req.createdAt) === currentMonthKey)
  const clearInquiryCount = currentMonthRequests.filter(req => !req.obfuscated).length
  const obfuscatedCount = hasProPlan ? 0 : currentMonthRequests.filter(req => req.obfuscated).length
  const resetLabel = monthlyResetLabel()
  const pendingRequests = visibleRequests.filter(r => r.status === 'pending')
  const nextRequest = pendingRequests[0]
  const categories = topCategories(visibleRequests)
  const contactCount = acceptedContactCount(visibleRequests)

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'pending', label: 'New', count: pendingCount },
    { id: 'quoted', label: 'Quoted', count: quotedCount },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'declined', label: 'Declined' },
    { id: 'all', label: 'All' },
  ]

  const quoteModalRequest = quoteModalId ? requests.find(r => r.id === quoteModalId) : null
  const declineModalOpen = declineModalId !== null

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12">

        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">Pro dashboard</p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            Jobs
          </h1>
          <p className="text-gray-500 text-base mt-2">
            {pendingCount > 0
              ? `${pendingCount} new request${pendingCount !== 1 ? 's' : ''} waiting for your response`
              : 'No new requests right now'}
          </p>
          {!hasProPlan && obfuscatedCount > 0 && (
            <p className="mt-2 max-w-2xl text-sm font-semibold text-orange-600">
              You&apos;ve used {clearInquiryCount} free clear view{clearInquiryCount === 1 ? '' : 's'} this month. {hiddenInquiryCopy(resetLabel)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <section className="lg:col-span-2">
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer border-none ${
                    tab === t.id ? 'bg-slate-800 text-white shadow-sm' : 'bg-transparent text-gray-600 hover:text-gray-900'
                  }`}
                  style={dg}
                >
                  {t.label}
                  {t.count != null && t.count > 0 && (
                    <span className={`ml-1.5 text-xs font-bold ${tab === t.id ? 'text-slate-200' : 'text-slate-500'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                    <div className="flex gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-100 rounded w-24" />
                        <div className="h-3 bg-gray-100 rounded w-16" />
                      </div>
                    </div>
                    <div className="h-14 bg-gray-50 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 && obfuscatedCount === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-base font-semibold mb-1">No {tab === 'all' ? '' : tab} requests</p>
                <p className="text-sm">
                  {tab === 'pending'
                    ? 'New requests from customers will appear here.'
                    : 'Nothing to show in this tab yet.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map(req => (
                  <JobCard
                    key={req.id}
                    req={req}
                    onAccept={id => setQuoteModalId(id)}
                    onDecline={id => setDeclineModalId(id)}
                  />
                ))}
                {obfuscatedCount > 0 && <HiddenInquiryUpgradeCard resetLabel={resetLabel} />}
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
            <ProUpgradeCta />

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">Mester brief</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Helpful to know</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-2xl font-black text-slate-800" style={dg}>{pendingCount}</p>
                  <p className="text-xs text-slate-500">Need quotes</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-2xl font-black text-slate-800" style={dg}>{acceptedCount}</p>
                  <p className="text-xs text-slate-500">Accepted jobs</p>
                </div>
              </div>
              <div className="divide-y divide-gray-100 mt-4">
                {[
                  ['Newest request', newestRequestLabel(requests)],
                  ['Quotes waiting', `${quotedCount}`],
                  ['Contacts available', `${contactCount}`],
                ].map(([label, value]) => (
                  <div key={label} className="py-2.5 flex justify-between gap-4 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {nextRequest && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">Next best action</p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-2" style={dg}>{nextRequest.categoryName}</h2>
                <p className="text-sm text-gray-500 mb-3">
                  {districtCopy(nextRequest)} · {timeAgo(nextRequest.createdAt) || 'just now'}
                </p>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700 leading-relaxed mb-3">
                  Check the scope, service area, availability, and whether materials or travel should be included before quoting.
                </div>
                <Link
                  href={`/pro/jobs/${nextRequest.id}`}
                  className="block text-center bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-2.5 text-sm"
                  style={dg}
                >
                  Review request
                </Link>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">Before sending quotes</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Ask yourself</h2>
              <ul className="flex flex-col gap-2.5 text-sm text-gray-600">
                {[
                  'Can I cover the district and arrival window?',
                  'Is my price clear about labour, materials, travel, and disposal?',
                  'Do I need photos, measurements, or a call before giving a firm quote?',
                  'What should the customer prepare before I arrive?',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-slate-400 flex-shrink-0 mt-0.5">○</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">Work mix</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Common requests</h2>
              {categories.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {categories.map(category => (
                    <div key={category.name} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-gray-800">{category.name}</span>
                      <span className="text-gray-400">{category.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Your request mix will appear here once customers contact you.</p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {quoteModalRequest && (
        <QuoteModal
          categoryName={quoteModalRequest.categoryName}
          onClose={() => setQuoteModalId(null)}
          onSubmit={data => handleQuoteSubmit(quoteModalRequest.id, data)}
        />
      )}

      {declineModalOpen && (
        <DeclineModal
          onClose={() => setDeclineModalId(null)}
          onConfirm={() => handleDeclineConfirm(declineModalId!)}
        />
      )}
    </main>
  )
}

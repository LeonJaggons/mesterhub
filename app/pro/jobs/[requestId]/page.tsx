'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { onAuthChange, waitForAuthReady } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { requestAppointment, type AppointmentRequestInput } from '@/firebase/conversations'
import { cancelServiceRequest, declineServiceRequestAsPro, markServiceRequestComplete, quoteServiceRequest } from '@/firebase/serviceRequests'
import {
  approximateLocationLabel,
  approximateRadiusMeters,
  requestCoords,
  type ServiceRequest as SharedServiceRequest,
} from '@/app/requests/shared'
import districtsData from '@/public/districts.json'
import { QuoteModal, DeclineModal, type QuoteFormData } from '../JobModals'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
import { FREE_CLEAR_INQUIRY_LIMIT, inquiryCreatedAtMillis, type InquiryTimestamp } from '@/lib/inquiryAccess'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

// Leaflet must be client-only (requires window)
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => (
  <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />
)})

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus = 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'

type Quote = {
  price: string
  timeline: string
  notes: string
  quotedAt: InquiryTimestamp
}

type AcceptanceDetails = {
  message?: string
  phone?: string
  address?: string
  preferredStart?: string
  acceptedAt?: InquiryTimestamp
}

type AppointmentRequest = AppointmentRequestInput & {
  status: 'proposed' | 'confirmed'
  requestedAt: InquiryTimestamp
  confirmedAt?: InquiryTimestamp
}

type ServiceRequest = {
  id: string
  projectId?: string
  proUid: string
  proName: string
  categoryName: string
  answers: Record<string, string>
  customerUid: string
  customerName: string
  customerEmail: string
  customerDistrict?: string
  jobLocation?: SharedServiceRequest['jobLocation']
  attachmentUrls?: string[]
  status: RequestStatus
  quote?: Quote
  acceptance?: AcceptanceDetails
  appointmentRequest?: AppointmentRequest
  completion?: { status?: 'pro_marked_complete' | 'confirmed_complete' }
  cancelReason?: string
  createdAt: InquiryTimestamp
  obfuscated?: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKey(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatVal(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(ts: InquiryTimestamp) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - inquiryCreatedAtMillis(ts)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function formatAppointmentDateTime(date: string, time: string): string {
  if (!date || !time) return [date, time].filter(Boolean).join(' at ')
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} at ${time}`
  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function districtLabel(roman: string) {
  const d = districtsData.districts.find(x => x.roman === roman)
  return d ? `${d.roman}. ${d.name}` : roman
}

function customerDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Customer'
  const [first, ...rest] = parts
  const lastInitial = rest.at(-1)?.[0]
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first
}

function requestAgeLabel(ts: InquiryTimestamp): string {
  const ago = timeAgo(ts)
  return ago ? `Posted ${ago}` : 'Posted recently'
}

function monthlyResetLabel(reference = new Date()): string {
  const resetDate = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  return resetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function topDecisionDetails(details: Array<[string, string]>): Array<[string, string]> {
  const priority = [
    'project_details',
    'preferred_timing',
    'urgency',
    'frequency',
    'property',
    'type',
    'issue',
    'work',
    'service',
    'task',
    'size',
    'area',
    'duration',
    'distance',
  ]
  return [...details]
    .sort(([a], [b]) => {
      const ai = priority.indexOf(a)
      const bi = priority.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
    .slice(0, 4)
}

function firstAnswer(answers: Record<string, string>, keys: string[]): [string, string] | null {
  for (const key of keys) {
    const value = answers[key]?.trim()
    if (value) return [key, value]
  }
  return null
}

function loginUrlFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`
}

function decisionTips(req: ServiceRequest, details: Array<[string, string]>): string[] {
  const tips = [
    `Is ${req.categoryName.toLowerCase()} work you cover?`,
    req.customerDistrict
      ? `${districtLabel(req.customerDistrict)} — is that in your service area?`
      : 'Customer has not shared a district yet; ask before quoting if travel matters.',
    details.length > 0
      ? 'Use the customer answers to decide whether this is a small job, visit, or custom quote.'
      : 'The customer gave limited details; ask clarifying questions before committing.',
    req.createdAt
      ? `${requestAgeLabel(req.createdAt)} — faster replies can help win the job.`
      : 'Reply quickly while the request is fresh.',
  ]

  if (req.customerEmail) tips.push('Email will be available if the customer accepts your quote.')
  return tips
}

function AppointmentModal({
  req,
  onClose,
  onSubmit,
}: {
  req: ServiceRequest
  onClose: () => void
  onSubmit: (input: AppointmentRequestInput) => Promise<void>
}) {
  const [kind, setKind] = useState<AppointmentRequestInput['kind']>('service')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60 minutes')
  const [location, setLocation] = useState(req.acceptance?.address ?? '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) {
      setError('Choose a date and time.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        kind,
        date,
        time,
        duration,
        location: location.trim(),
        notes: notes.trim(),
      })
    } catch {
      setError('Could not send the appointment request. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.58)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">Appointment request</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              Schedule with {req.customerName || 'the customer'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Propose a time now that the quote has been accepted.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer flex-shrink-0 p-1 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-sm font-medium text-gray-700 mb-2">Appointment type</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'quote' as const, label: 'Quote visit', body: 'Inspect or confirm the scope first.' },
                { id: 'service' as const, label: 'Service appointment', body: 'Schedule the accepted job.' },
              ].map(option => (
                <label
                  key={option.id}
                  className={`rounded-xl border p-3 cursor-pointer ${
                    kind === option.id ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="appointment-kind"
                    value={option.id}
                    checked={kind === option.id}
                    onChange={() => setKind(option.id)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-semibold text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500 mt-1">{option.body}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Date
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Time
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Duration
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                {['30 minutes', '60 minutes', '90 minutes', '2 hours', 'Half day', 'Full day'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Location or meeting note
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Customer address, district, or video call"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Message to customer
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Mention what the customer should prepare and whether this is for a quote visit or the service."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-xl text-sm transition-colors cursor-pointer bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !date || !time}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-3 text-base transition-colors border-none cursor-pointer"
              style={dg}
            >
              {submitting ? 'Sending...' : 'Send appointment request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CANCEL_REASONS = [
  'Outside my service area',
  'Schedule does not work',
  'Not the right fit for my services',
  'Need more information before I can commit',
  'Customer requested cancellation',
  'Other',
]

function CancelRequestModal({
  customerName,
  onClose,
  onConfirm,
}: {
  customerName: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const note = [
        `Reason: ${reason}`,
        details.trim() ? `Details: ${details.trim()}` : '',
      ].filter(Boolean).join('\n')
      await onConfirm(note)
    } catch {
      setError('Could not cancel this request. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.58)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">Cancel request</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              Cancel with {customerName}?
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              The customer will be notified and this job will move out of your active queue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer flex-shrink-0 p-1 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Why are you cancelling?
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              {CANCEL_REASONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Details for the customer <span className="text-gray-400 font-normal">(optional)</span>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={4}
              placeholder="Add context, suggest what to do next, or mention whether they can rebook later."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm cursor-pointer bg-white"
            >
              Keep request
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black rounded-xl py-3 text-sm cursor-pointer border-none"
              style={dg}
            >
              {submitting ? 'Cancelling...' : 'Cancel request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RequestDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params)
  const router = useRouter()

  const [req, setReq] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [obfuscated, setObfuscated] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function loadRequestForUser() {
      await waitForAuthReady()
      if (cancelled) return

      unsubscribe = onAuthChange(async user => {
        const nextPath = `/pro/jobs/${requestId}`
        if (!user) {
          router.replace(loginUrlFor(nextPath))
          return
        }

        try {
          const res = await authenticatedFetch(`/api/pro/service-requests/${requestId}`)
          const payload = await res.json()
          const data = payload.request as ServiceRequest | undefined
          if (!data) { setForbidden(true); setLoading(false); return }
          const canViewInquiry = data.obfuscated !== true
          setObfuscated(!canViewInquiry)

          if (canViewInquiry && data.appointmentRequest?.status === 'confirmed') {
            router.replace(`/pro/appointment/${requestId}`)
            return
          }

          setReq(data)
        } catch {
          setForbidden(true)
        } finally {
          setLoading(false)
        }
      })
    }

    loadRequestForUser()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [requestId, router])

  async function handleQuoteSubmit(data: QuoteFormData) {
    if (!req) return
    await quoteServiceRequest(requestId, data)
    setReq(r => r ? { ...r, status: 'quoted', quote: { ...data, quotedAt: null } } : r)
    setShowQuoteModal(false)
  }

  async function handleDeclineConfirm() {
    if (!req) return
    await declineServiceRequestAsPro(requestId)
    setReq(r => r ? { ...r, status: 'declined' } : r)
    setShowDeclineModal(false)
  }

  async function handleAppointmentSubmit(input: AppointmentRequestInput) {
    if (!req || req.status !== 'accepted') return
    await requestAppointment(requestId, req.proUid, input)
    setReq(r => r ? {
      ...r,
      appointmentRequest: {
        ...input,
        location: input.location ?? '',
        jobLocation: req.jobLocation ?? null,
        notes: input.notes ?? '',
        status: 'proposed',
        requestedAt: null,
        confirmedAt: null,
      },
    } : r)
    setShowAppointmentModal(false)
  }

  async function handleMarkComplete() {
    if (!req) return
    await markServiceRequestComplete(requestId)
    setReq(r => r ? { ...r, completion: { status: 'pro_marked_complete' } } : r)
  }

  async function handleCancel(reason: string) {
    if (!req) return
    await cancelServiceRequest(requestId, reason)
    setReq(r => r ? { ...r, status: 'cancelled', cancelReason: reason } : r)
    setShowCancelModal(false)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-14 animate-pulse">
        <div className="h-6 bg-gray-100 rounded w-24 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="h-64 bg-gray-100 rounded-xl" />
            <div className="h-32 bg-gray-100 rounded-xl" />
          </div>
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (forbidden || !req) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>Not accessible</p>
        <p className="text-gray-500 mb-6 text-sm">This request doesn&apos;t exist or you don&apos;t have permission to view it.</p>
        <button onClick={() => router.push('/pro/jobs')} className="bg-orange-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer border-none">
          Back to Jobs
        </button>
      </div>
    )
  }

  if (obfuscated) {
    const resetLabel = monthlyResetLabel()
    return (
      <main className="bg-gray-50 min-h-screen pb-16">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <button
            onClick={() => router.push('/pro/jobs')}
            className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            ← Back to Jobs
          </button>
          <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Inquiry hidden</p>
            <h1 className="text-4xl font-black text-gray-900 leading-none mb-3" style={dg}>
              Upgrade to view this request
            </h1>
            <p className="text-sm leading-relaxed text-gray-600 mb-5">
              You can view {FREE_CLEAR_INQUIRY_LIMIT} inquiries per month for free. This inquiry is saved, but its job details, location, and customer context are hidden until you upgrade or your free views reset on {resetLabel}.
            </p>
            <div className="relative mb-5 overflow-hidden rounded-xl border border-orange-100 bg-orange-50 p-4">
              <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
                <div className="mb-3 h-5 w-4/5 rounded bg-slate-300/80" />
                <div className="mb-3 h-4 w-2/3 rounded bg-slate-300/70" />
                <div className="h-4 w-1/2 rounded bg-slate-300/60" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-orange-50/80 px-4 text-center text-sm font-bold text-gray-900">
                Details hidden until Pro or {resetLabel}
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm">
              <div className="flex justify-between gap-4 py-1.5">
                <span className="text-gray-500">Category</span>
                <span className="font-semibold text-gray-900">{req.categoryName}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5">
                <span className="text-gray-500">Status</span>
                <span className="font-semibold text-gray-900">{req.status}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5">
                <span className="text-gray-500">Received</span>
                <span className="font-semibold text-gray-900">{requestAgeLabel(req.createdAt)}</span>
              </div>
            </div>
          </section>
          <div className="mt-4">
            <ProUpgradeCta />
          </div>
        </div>
      </main>
    )
  }

  const coords = requestCoords(req)
  const mapLabel = req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
  const locationSummary = req.jobLocation
    ? approximateLocationLabel(req.jobLocation)
    : req.customerDistrict
    ? mapLabel
    : 'Budapest'
  const details = Object.entries(req.answers).filter(([, v]) => v)
  const needSummary = firstAnswer(req.answers, ['project_details', 'issue', 'task'])
  const urgencyDetail = firstAnswer(req.answers, ['urgency'])
  const timingDetail = firstAnswer(req.answers, ['preferred_timing', 'timing', 'availability', 'preferred_start', 'start_date'])
  const highlightedKeys = new Set([
    needSummary?.[0],
    urgencyDetail?.[0],
    timingDetail?.[0],
  ].filter((key): key is string => Boolean(key)))
  const secondaryDetails = details.filter(([key]) => !highlightedKeys.has(key))
  const decisionDetails = topDecisionDetails(secondaryDetails)
  const quickDetails = decisionDetails.length > 0 ? decisionDetails : secondaryDetails.slice(0, 4)
  const quickDetailKeys = new Set(quickDetails.map(([key]) => key))
  const remainingDetails = secondaryDetails.filter(([key]) => !quickDetailKeys.has(key))
  const primaryDetail = needSummary ?? quickDetails[0]
  const customerName = customerDisplayName(req.customerName)
  const tips = decisionTips(req, details)
  const isPending = req.status === 'pending'
  const isQuoted = req.status === 'quoted'
  const isAccepted = req.status === 'accepted'
  const isCompleted = req.status === 'completed'
  const canCancel = req.status === 'pending' || req.status === 'quoted' || req.status === 'accepted'

  return (
    <main className="bg-gray-50 min-h-screen pb-16">
      <div className="max-w-4xl mx-auto px-4 py-12">

        {/* Back */}
        <button
          onClick={() => router.push('/pro/jobs')}
          className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 bg-transparent border-none cursor-pointer"
        >
          ← Back to Jobs
        </button>

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Job request</p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {req.categoryName}
          </h1>
        </div>

        {/* Status banner */}
        {!isPending && (
          <div className={`rounded-xl p-3 mb-5 text-sm font-semibold text-center ${
            isCompleted
              ? 'bg-slate-800 text-white border border-slate-800'
              : isQuoted
              ? 'bg-slate-50 text-slate-800 border border-slate-200'
              : isAccepted
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {isCompleted
              ? 'Job completed'
              : isQuoted
              ? 'Quote sent. Awaiting customer response.'
              : isAccepted
              ? '✓ Customer accepted your quote'
              : req.status === 'cancelled'
              ? 'Request cancelled'
              : 'You declined this request'}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* Left — job brief */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Job brief */}
            <section className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="mb-5">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Job brief</p>
                <h2 className="font-black text-gray-900 text-3xl leading-none mb-2" style={dg}>
                  {primaryDetail ? formatVal(primaryDetail[1]) : req.categoryName}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-full px-3 py-1">
                    {req.categoryName}
                  </span>
                  {req.customerDistrict && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-semibold rounded-full px-3 py-1">
                      {districtLabel(req.customerDistrict)}
                    </span>
                  )}
                  <span className="bg-gray-100 text-gray-400 text-xs rounded-full px-3 py-1">
                    {requestAgeLabel(req.createdAt)}
                  </span>
                </div>
              </div>

              {(urgencyDetail || timingDetail) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {urgencyDetail && (
                    <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
                      <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">Urgency</p>
                      <p className="text-base font-black text-gray-900" style={dg}>{formatVal(urgencyDetail[1])}</p>
                    </div>
                  )}
                  {timingDetail && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                      <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-1">Timing</p>
                      <p className="text-base font-black text-gray-900" style={dg}>{formatVal(timingDetail[1])}</p>
                    </div>
                  )}
                </div>
              )}

              {quickDetails.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {quickDetails.map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <p className="text-xs text-gray-400 mb-1">{formatKey(key)}</p>
                      <p className="text-sm font-bold text-gray-900 leading-snug">{formatVal(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-5">No specific details provided.</p>
              )}

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 mb-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Approximate location</p>
                    <p className="text-sm font-semibold text-gray-900">{locationSummary}</p>
                  </div>
                  {req.customerDistrict && (
                    <span className="shrink-0 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
                      District {req.customerDistrict}
                    </span>
                  )}
                </div>
                <MapView
                  lat={coords[0]}
                  lng={coords[1]}
                  districtLabel={locationSummary}
                  radius={approximateRadiusMeters(req.jobLocation)}
                  popupText={locationSummary}
                />
                <p className="text-xs text-gray-400 mt-2">
                  {req.jobLocation
                    ? 'Location shown is approximate from the customer permission. Exact address is shared after they accept your quote.'
                    : 'Location shown is the centre of the customer&apos;s district. Exact address is shared after they accept your quote.'}
                </p>
              </div>

              {req.attachmentUrls?.length ? (
                <div className="mb-5">
                  <h3 className="font-black text-gray-900 text-xl leading-none mb-2" style={dg}>Customer attachments</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {req.attachmentUrls.map((url, index) => (
                      <a
                        key={`${url}-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        {/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url) ? (
                          <img src={url} alt={`Customer attachment ${index + 1}`} className="h-28 w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="flex h-28 items-center justify-center px-3 text-center text-sm font-bold text-gray-600">
                            Attachment {index + 1}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {remainingDetails.length > 0 && (
                <div>
                  <h3 className="font-black text-gray-900 text-xl leading-none mb-2" style={dg}>More details</h3>
                  <div className="divide-y divide-gray-100">
                    {remainingDetails.map(([k, v]) => (
                      <div key={k} className="py-2.5 flex justify-between gap-4 items-start">
                        <span className="text-sm text-gray-500">{formatKey(k)}</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">{formatVal(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Contact info — only after customer accepts */}
            {isAccepted && (
              <section className="bg-green-50 rounded-2xl border border-green-100 p-5">
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Customer contact</h2>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-14">Name</span>
                    <span className="font-semibold text-gray-900">{req.customerName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-14">Email</span>
                    <a href={`mailto:${req.customerEmail}`} className="font-semibold text-orange-500 hover:underline">
                      {req.customerEmail}
                    </a>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Right — decision panel */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Action card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-2" style={dg}>
                {isPending ? 'Make a decision' : isQuoted ? 'Quote sent' : isAccepted ? 'Accepted' : 'Declined'}
              </h2>

              {isPending && (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    Review the details and send a quote. The customer can then accept or decline it.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowQuoteModal(true)}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl py-3 text-base transition-colors cursor-pointer border-none"
                      style={dg}
                    >
                      Send a quote
                    </button>
                    <button
                      onClick={() => setShowDeclineModal(true)}
                      className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-xl py-2.5 text-sm transition-colors cursor-pointer bg-white"
                    >
                      Decline
                    </button>
                  </div>
                </>
              )}

              {isQuoted && req.quote && (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    Your quote has been sent. The customer will accept or decline it.
                  </p>
                  <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Price</span>
                      <span className="font-bold text-gray-900">{req.quote.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Start</span>
                      <span className="font-semibold text-gray-900">{req.quote.timeline}</span>
                    </div>
                    {req.quote.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-gray-500 mb-1">Your message</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{req.quote.notes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {isAccepted && req.quote && (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    The customer accepted your quote. Contact them to arrange the job.
                  </p>
                  <div className="bg-green-50 rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Agreed price</span>
                      <span className="font-bold text-gray-900">{req.quote.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Start</span>
                      <span className="font-semibold text-gray-900">{req.quote.timeline}</span>
                    </div>
                  </div>
                  {req.appointmentRequest && (
                    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3 text-sm">
                      <p className="text-xs font-bold text-orange-700 mb-1">Appointment proposed</p>
                      <p className="font-semibold text-gray-900">
                        {formatAppointmentDateTime(
                          req.appointmentRequest.date,
                          req.appointmentRequest.time
                        )}
                      </p>
                      <p className="text-gray-500">{req.appointmentRequest.duration}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(true)}
                    className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-3 text-base transition-colors cursor-pointer border-none"
                    style={dg}
                  >
                    {req.appointmentRequest ? 'Update appointment request' : 'Schedule appointment'}
                  </button>
                  {req.completion?.status === 'pro_marked_complete' ? (
                    <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                      Waiting for the customer to confirm completion.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      className="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl py-3 text-base transition-colors cursor-pointer border-none"
                      style={dg}
                    >
                      Mark job complete
                    </button>
                  )}
                </>
              )}

              {req.status === 'declined' && (
                <p className="text-xs text-gray-400 mt-1">You declined this request.</p>
              )}
              {req.status === 'cancelled' && (
                <p className="text-xs text-gray-400 mt-1">This request was cancelled{req.cancelReason ? `: ${req.cancelReason}` : ''}.</p>
              )}
              {req.status === 'completed' && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                  The customer confirmed this job is complete.
                </p>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="mt-3 w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-xl py-2.5 text-sm transition-colors cursor-pointer bg-white"
                >
                  Cancel request
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Customer context</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>
                {customerName}
              </h2>
              <div className="divide-y divide-gray-100">
                {[
                  ['Request age', requestAgeLabel(req.createdAt)],
                  ['Location', req.jobLocation ? `${locationSummary}${req.customerDistrict ? ` · ${mapLabel}` : ''}` : req.customerDistrict ? mapLabel : 'District not shared'],
                  ['Contact', isAccepted ? 'Available after acceptance' : 'Hidden until quote is accepted'],
                  ['Detail level', details.length > 0 ? `${details.length} answer${details.length === 1 ? '' : 's'} provided` : 'Limited detail'],
                ].map(([label, value]) => (
                  <div key={label} className="py-2.5 flex justify-between gap-4 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right">{value}</span>
                  </div>
                ))}
              </div>
              {decisionDetails.length > 0 && (
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {decisionDetails.map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                      <p className="text-xs text-gray-400 mb-1">{formatKey(key)}</p>
                      <p className="text-sm font-semibold text-gray-900">{formatVal(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checklist to help decision — only while pending */}
            {isPending && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Things to consider</h2>
                <ul className="flex flex-col gap-2.5 text-sm text-gray-600">
                  {tips.map(tip => (
                    <li key={tip} className="flex items-start gap-2">
                      <span className="text-orange-400 flex-shrink-0 mt-0.5">○</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tips — only while pending */}
            {isPending && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-orange-700 mb-1">Respond quickly</p>
                <p className="text-xs text-orange-600 leading-relaxed">
                  Pros who respond within 1 hour win 3× more jobs. Even a quick &ldquo;I&apos;ll be in touch shortly&rdquo; builds trust.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showQuoteModal && (
        <QuoteModal
          categoryName={req.categoryName}
          onClose={() => setShowQuoteModal(false)}
          onSubmit={handleQuoteSubmit}
        />
      )}

      {showDeclineModal && (
        <DeclineModal
          onClose={() => setShowDeclineModal(false)}
          onConfirm={handleDeclineConfirm}
        />
      )}
      {showAppointmentModal && req.status === 'accepted' && (
        <AppointmentModal
          req={req}
          onClose={() => setShowAppointmentModal(false)}
          onSubmit={handleAppointmentSubmit}
        />
      )}
      {showCancelModal && (
        <CancelRequestModal
          customerName={customerName}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancel}
        />
      )}
    </main>
  )
}

'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { onAuthChange, waitForAuthReady } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { requestAppointment, type AppointmentRequestInput } from '@/firebase/conversations'
import { cancelServiceRequest, declineServiceRequestAsPro, markServiceRequestComplete, quoteServiceRequest } from '@/firebase/serviceRequests'
import ReportUserButton from '@/app/components/reports/ReportUserButton'
import {
  approximateRadiusMeters,
  requestCoords,
  type ServiceRequest as SharedServiceRequest,
} from '@/app/requests/shared'
import districtsData from '@/public/districts.json'
import { QuoteModal, DeclineModal, translateQuoteTimeline, type QuoteFormData } from '../JobModals'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
import { FREE_CLEAR_INQUIRY_LIMIT, inquiryCreatedAtMillis, type InquiryTimestamp } from '@/lib/inquiryAccess'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type Translator = ReturnType<typeof useTranslations>

// Leaflet must be client-only (requires window)
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => (
  <div className="h-64 rounded-md bg-gray-100 animate-pulse" />
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

function answerTranslationKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function formatKey(t: Translator, k: string) {
  return t(`taxonomy.answers.keys.${k}`, {
    defaultValue: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  })
}

function formatVal(t: Translator, v: string) {
  const key = answerTranslationKey(v)
  return key
    ? t(`taxonomy.answers.values.${key}`, {
        defaultValue: v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      })
    : v
}

function timeAgo(t: Translator, ts: InquiryTimestamp) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - inquiryCreatedAtMillis(ts)) / 1000)
  if (s < 60) return t('proJobs.time.justNow')
  if (s < 3600) return t('proJobs.time.minutesAgo', { count: Math.floor(s / 60) })
  if (s < 86400) return t('proJobs.time.hoursAgo', { count: Math.floor(s / 3600) })
  return t('proJobs.time.daysAgo', { count: Math.floor(s / 86400) })
}

function formatAppointmentDateTime(locale: string, t: Translator, date: string, time: string): string {
  if (!date || !time) return [date, time].filter(Boolean).join(` ${t('proJobs.detail.appointment.at')} `)
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} ${t('proJobs.detail.appointment.at')} ${time}`
  return parsed.toLocaleString(locale, {
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

function customerDisplayName(t: Translator, name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return t('proJobs.customerFallback')
  const [first, ...rest] = parts
  const lastInitial = rest.at(-1)?.[0]
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first
}

function requestAgeLabel(t: Translator, ts: InquiryTimestamp): string {
  const ago = timeAgo(t, ts)
  return ago ? t('proJobs.detail.postedAgo', { time: ago }) : t('proJobs.detail.postedRecently')
}

function monthlyResetLabel(locale: string, reference = new Date()): string {
  const resetDate = new Date(reference.getFullYear(), reference.getMonth() + 1, 1)
  return resetDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
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

function approximateLocationCopy(t: Translator, location: ServiceRequest['jobLocation']): string {
  const meters = approximateRadiusMeters(location)
  if (!location?.accuracy) return t('proJobs.location.approximate')
  if (meters >= 1000) return t('proJobs.location.approximateKm', { distance: (meters / 1000).toFixed(1) })
  return t('proJobs.location.approximateM', { distance: meters })
}

function translateDuration(t: Translator, duration: string): string {
  const durations: Record<string, string> = {
    '30 minutes': 'thirtyMinutes',
    '60 minutes': 'sixtyMinutes',
    '90 minutes': 'ninetyMinutes',
    '2 hours': 'twoHours',
    'Half day': 'halfDay',
    'Full day': 'fullDay',
  }
  const key = durations[duration]
  return key ? t(`proJobs.detail.appointmentModal.durations.${key}`) : duration
}

function decisionTips(t: Translator, req: ServiceRequest, details: Array<[string, string]>): string[] {
  const categoryLabel = translateCategory(t, req.categoryName).toLowerCase()
  const tips = [
    t('proJobs.detail.tips.coverage', { category: categoryLabel }),
    req.customerDistrict
      ? t('proJobs.detail.tips.serviceArea', { district: districtLabel(req.customerDistrict) })
      : t('proJobs.detail.tips.noDistrict'),
    details.length > 0
      ? t('proJobs.detail.tips.useAnswers')
      : t('proJobs.detail.tips.limitedDetails'),
    req.createdAt
      ? t('proJobs.detail.tips.replyWithAge', { age: requestAgeLabel(t, req.createdAt) })
      : t('proJobs.detail.tips.replyFresh'),
  ]

  if (req.customerEmail) tips.push(t('proJobs.detail.tips.emailAfterAccept'))
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
  const t = useTranslations()
  const [kind, setKind] = useState<AppointmentRequestInput['kind']>('service')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('60 minutes')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) {
      setError(t('proJobs.detail.appointmentModal.errors.dateTimeRequired'))
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
      setError(t('proJobs.detail.appointmentModal.errors.generic'))
      setSubmitting(false)
    }
  }

  const durationOptions = [
    { value: '30 minutes', label: t('proJobs.detail.appointmentModal.durations.thirtyMinutes') },
    { value: '60 minutes', label: t('proJobs.detail.appointmentModal.durations.sixtyMinutes') },
    { value: '90 minutes', label: t('proJobs.detail.appointmentModal.durations.ninetyMinutes') },
    { value: '2 hours', label: t('proJobs.detail.appointmentModal.durations.twoHours') },
    { value: 'Half day', label: t('proJobs.detail.appointmentModal.durations.halfDay') },
    { value: 'Full day', label: t('proJobs.detail.appointmentModal.durations.fullDay') },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.58)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-xl shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-1">{t('proJobs.detail.appointmentModal.kicker')}</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {t('proJobs.detail.appointmentModal.title', { customer: req.customerName || t('proJobs.detail.customerFallbackLower') })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('proJobs.detail.appointmentModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer flex-shrink-0 p-1 text-2xl leading-none"
            aria-label={t('proJobs.quoteModal.close')}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-sm font-medium text-gray-700 mb-2">{t('proJobs.detail.appointmentModal.typeLabel')}</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'quote' as const,
                  label: t('proJobs.detail.appointmentModal.types.quote.label'),
                  body: t('proJobs.detail.appointmentModal.types.quote.body'),
                },
                {
                  id: 'service' as const,
                  label: t('proJobs.detail.appointmentModal.types.service.label'),
                  body: t('proJobs.detail.appointmentModal.types.service.body'),
                },
              ].map(option => (
                <label
                  key={option.id}
                  className={`rounded-md border p-3 cursor-pointer ${
                    kind === option.id ? 'border-sky-300 bg-sky-50' : 'border-gray-200 bg-white'
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
              {t('proJobs.detail.appointmentModal.date')}
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proJobs.detail.appointmentModal.time')}
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proJobs.detail.appointmentModal.duration')}
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {durationOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proJobs.detail.appointmentModal.meetingNote')}
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={t('proJobs.detail.appointmentModal.meetingNotePlaceholder')}
              className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proJobs.detail.appointmentModal.message')}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={t('proJobs.detail.appointmentModal.messagePlaceholder')}
              className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-md text-sm transition-colors cursor-pointer bg-white"
            >
              {t('proJobs.quoteModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !date || !time}
              className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-md py-3 text-base transition-colors border-none cursor-pointer"
              style={dg}
            >
              {submitting ? t('proJobs.detail.appointmentModal.sending') : t('proJobs.detail.appointmentModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const CANCEL_REASONS = [
  { value: 'Outside my service area', key: 'outsideServiceArea' },
  { value: 'Schedule does not work', key: 'scheduleDoesNotWork' },
  { value: 'Not the right fit for my services', key: 'notRightFit' },
  { value: 'Need more information before I can commit', key: 'needMoreInformation' },
  { value: 'Customer requested cancellation', key: 'customerRequested' },
  { value: 'Other', key: 'other' },
] as const

function CancelRequestModal({
  customerName,
  onClose,
  onConfirm,
}: {
  customerName: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const t = useTranslations()
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0].value)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const reasonLabel = t(`proJobs.detail.cancelModal.reasons.${CANCEL_REASONS.find(item => item.value === reason)?.key ?? 'other'}`)
      const note = [
        t('proJobs.detail.cancelModal.reasonNote', { reason: reasonLabel }),
        details.trim() ? t('proJobs.detail.cancelModal.detailsNote', { details: details.trim() }) : '',
      ].filter(Boolean).join('\n')
      await onConfirm(note)
    } catch {
      setError(t('proJobs.detail.cancelModal.errors.generic'))
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
        className="bg-white rounded-lg w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-1">{t('proJobs.detail.cancelModal.kicker')}</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {t('proJobs.detail.cancelModal.title', { customer: customerName })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('proJobs.detail.cancelModal.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer flex-shrink-0 p-1 text-2xl leading-none"
            aria-label={t('proJobs.quoteModal.close')}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proJobs.detail.cancelModal.reasonLabel')}
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {CANCEL_REASONS.map(option => (
                <option key={option.value} value={option.value}>
                  {t(`proJobs.detail.cancelModal.reasons.${option.key}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proJobs.detail.cancelModal.detailsLabel')} <span className="text-gray-400 font-normal">({t('proJobs.quoteModal.optional')})</span>
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={4}
              placeholder={t('proJobs.detail.cancelModal.detailsPlaceholder')}
              className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-md py-3 text-sm cursor-pointer bg-white"
            >
              {t('proJobs.declineModal.keep')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black rounded-md py-3 text-sm cursor-pointer border-none"
              style={dg}
            >
              {submitting ? t('proJobs.detail.cancelModal.cancelling') : t('proJobs.detail.cancelModal.submit')}
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
  const t = useTranslations()
  const locale = useLocale()

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
        <div className="h-6 bg-gray-100 rounded-sm w-24 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="h-64 bg-gray-100 rounded-md" />
            <div className="h-32 bg-gray-100 rounded-md" />
          </div>
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-md" />
        </div>
      </div>
    )
  }

  if (forbidden || !req) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>{t('proJobs.detail.notAccessible.title')}</p>
        <p className="text-gray-500 mb-6 text-sm">{t('proJobs.detail.notAccessible.body')}</p>
        <button onClick={() => router.push('/pro/jobs')} className="bg-sky-500 text-white rounded px-5 py-2.5 text-sm font-semibold hover:bg-sky-600 transition-colors cursor-pointer border-none">
          {t('proJobs.detail.backToJobs')}
        </button>
      </div>
    )
  }

  if (obfuscated) {
    const resetLabel = monthlyResetLabel(locale)
    return (
      <main className="bg-gray-50 min-h-screen pb-16">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <button
            onClick={() => router.push('/pro/jobs')}
            className="text-sm text-gray-400 hover:text-gray-600 mb-6 flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            ← {t('proJobs.detail.backToJobs')}
          </button>
          <section className="rounded-lg border border-sky-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proJobs.detail.hidden.kicker')}</p>
            <h1 className="text-4xl font-black text-gray-900 leading-none mb-3" style={dg}>
              {t('proJobs.detail.hidden.title')}
            </h1>
            <p className="text-sm leading-relaxed text-gray-600 mb-5">
              {t('proJobs.detail.hidden.body', { limit: FREE_CLEAR_INQUIRY_LIMIT, resetLabel })}
            </p>
            <div className="relative mb-5 overflow-hidden rounded-md border border-sky-100 bg-sky-50 p-4">
              <div className="pointer-events-none select-none blur-[3px]" aria-hidden="true">
                <div className="mb-3 h-5 w-4/5 rounded-sm bg-slate-300/80" />
                <div className="mb-3 h-4 w-2/3 rounded-sm bg-slate-300/70" />
                <div className="h-4 w-1/2 rounded-sm bg-slate-300/60" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-sky-50/80 px-4 text-center text-sm font-bold text-gray-900">
                {t('proJobs.detail.hidden.overlay', { resetLabel })}
              </div>
            </div>
            <div className="rounded-md bg-gray-50 border border-gray-100 p-4 text-sm">
              <div className="flex justify-between gap-4 py-1.5">
                <span className="text-gray-500">{t('proJobs.detail.labels.category')}</span>
                <span className="font-semibold text-gray-900">{translateCategory(t, req.categoryName)}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5">
                <span className="text-gray-500">{t('proJobs.detail.labels.status')}</span>
                <span className="font-semibold text-gray-900">{t(`proJobs.status.${req.status}`)}</span>
              </div>
              <div className="flex justify-between gap-4 py-1.5">
                <span className="text-gray-500">{t('proJobs.detail.labels.received')}</span>
                <span className="font-semibold text-gray-900">{requestAgeLabel(t, req.createdAt)}</span>
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
    ? approximateLocationCopy(t, req.jobLocation)
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
  const customerName = customerDisplayName(t, req.customerName)
  const categoryLabel = translateCategory(t, req.categoryName)
  const tips = decisionTips(t, req, details)
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
          ← {t('proJobs.detail.backToJobs')}
        </button>

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proJobs.detail.header.kicker')}</p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {categoryLabel}
          </h1>
        </div>

        {/* Status banner */}
        {!isPending && (
          <div className={`rounded-md p-3 mb-5 text-sm font-semibold text-center ${
            isCompleted
              ? 'bg-slate-800 text-white border border-slate-800'
              : isQuoted
              ? 'bg-slate-50 text-slate-800 border border-slate-200'
              : isAccepted
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {isCompleted
              ? t('proJobs.detail.statusBanner.completed')
              : isQuoted
              ? t('proJobs.detail.statusBanner.quoted')
              : isAccepted
              ? `✓ ${t('proJobs.detail.statusBanner.accepted')}`
              : req.status === 'cancelled'
              ? t('proJobs.detail.statusBanner.cancelled')
              : t('proJobs.detail.statusBanner.declined')}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* Left — job brief */}
          <div className="lg:col-span-3 flex flex-col gap-4">

            {/* Job brief */}
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="mb-5">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proJobs.detail.brief.kicker')}</p>
                <h2 className="font-black text-gray-900 text-3xl leading-none mb-2" style={dg}>
                  {primaryDetail ? formatVal(t, primaryDetail[1]) : categoryLabel}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-sky-50 text-sky-700 border border-sky-200 text-xs font-semibold rounded-full px-3 py-1">
                    {categoryLabel}
                  </span>
                  {req.customerDistrict && (
                    <span className="bg-gray-100 text-gray-600 text-xs font-semibold rounded-full px-3 py-1">
                      {districtLabel(req.customerDistrict)}
                    </span>
                  )}
                  <span className="bg-gray-100 text-gray-400 text-xs rounded-full px-3 py-1">
                    {requestAgeLabel(t, req.createdAt)}
                  </span>
                </div>
              </div>

              {(urgencyDetail || timingDetail) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {urgencyDetail && (
                    <div className="rounded-md bg-sky-50 border border-sky-100 p-4">
                      <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-1">{t('proJobs.detail.brief.urgency')}</p>
                      <p className="text-base font-black text-gray-900" style={dg}>{formatVal(t, urgencyDetail[1])}</p>
                    </div>
                  )}
                  {timingDetail && (
                    <div className="rounded-md bg-slate-50 border border-slate-100 p-4">
                      <p className="text-xs font-bold tracking-widest uppercase text-slate-500 mb-1">{t('proJobs.detail.brief.timing')}</p>
                      <p className="text-base font-black text-gray-900" style={dg}>{formatVal(t, timingDetail[1])}</p>
                    </div>
                  )}
                </div>
              )}

              {quickDetails.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  {quickDetails.map(([key, value]) => (
                    <div key={key} className="rounded-md bg-slate-50 border border-slate-100 p-3">
                      <p className="text-xs text-gray-400 mb-1">{formatKey(t, key)}</p>
                      <p className="text-sm font-bold text-gray-900 leading-snug">{formatVal(t, value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-5">{t('proJobs.detail.brief.noDetails')}</p>
              )}

              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 mb-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">{t('proJobs.detail.brief.approximateLocation')}</p>
                    <p className="text-sm font-semibold text-gray-900">{locationSummary}</p>
                  </div>
                  {req.customerDistrict && (
                    <span className="shrink-0 rounded-full bg-white border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">
                      {t('proJobs.location.district', { district: req.customerDistrict })}
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
                    ? t('proJobs.detail.brief.locationPermissionNote')
                    : t('proJobs.detail.brief.locationDistrictNote')}
                </p>
              </div>

              {req.attachmentUrls?.length ? (
                <div className="mb-5">
                  <h3 className="font-black text-gray-900 text-xl leading-none mb-2" style={dg}>{t('proJobs.detail.brief.attachments')}</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {req.attachmentUrls.map((url, index) => (
                      <a
                        key={`${url}-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                      >
                        {/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url) ? (
                          <img src={url} alt={t('proJobs.detail.brief.attachmentAlt', { index: index + 1 })} className="h-28 w-full object-cover transition-transform group-hover:scale-105" />
                        ) : (
                          <div className="flex h-28 items-center justify-center px-3 text-center text-sm font-bold text-gray-600">
                            {t('proJobs.detail.brief.attachmentLabel', { index: index + 1 })}
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {remainingDetails.length > 0 && (
                <div>
                  <h3 className="font-black text-gray-900 text-xl leading-none mb-2" style={dg}>{t('proJobs.detail.brief.moreDetails')}</h3>
                  <div className="divide-y divide-gray-100">
                    {remainingDetails.map(([k, v]) => (
                      <div key={k} className="py-2.5 flex justify-between gap-4 items-start">
                        <span className="text-sm text-gray-500">{formatKey(t, k)}</span>
                        <span className="text-sm font-semibold text-gray-900 text-right">{formatVal(t, v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Contact info — only after customer accepts */}
            {isAccepted && (
              <section className="bg-green-50 rounded-lg border border-green-100 p-5">
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proJobs.detail.contact.title')}</h2>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-14">{t('proJobs.detail.labels.name')}</span>
                    <span className="font-semibold text-gray-900">{req.customerName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-14">{t('proJobs.detail.labels.email')}</span>
                    <a href={`mailto:${req.customerEmail}`} className="font-semibold text-sky-500 hover:underline">
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
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-2" style={dg}>
                {isPending
                  ? t('proJobs.detail.action.title.pending')
                  : isQuoted
                  ? t('proJobs.status.quoted')
                  : isAccepted
                  ? t('proJobs.status.accepted')
                  : req.status === 'cancelled'
                  ? t('proJobs.status.cancelled')
                  : t('proJobs.status.declined')}
              </h2>

              {isPending && (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    {t('proJobs.detail.action.pendingBody')}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setShowQuoteModal(true)}
                      className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black rounded-md py-3 text-base transition-colors cursor-pointer border-none"
                      style={dg}
                    >
                      {t('proJobs.card.sendQuote')}
                    </button>
                    <button
                      onClick={() => setShowDeclineModal(true)}
                      className="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-md py-2.5 text-sm transition-colors cursor-pointer bg-white"
                    >
                      {t('proJobs.card.decline')}
                    </button>
                  </div>
                </>
              )}

              {isQuoted && req.quote && (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    {t('proJobs.detail.action.quotedBody')}
                  </p>
                  <div className="bg-slate-50 rounded-md p-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('proJobs.detail.labels.price')}</span>
                      <span className="font-bold text-gray-900">{req.quote.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('proJobs.detail.labels.start')}</span>
                      <span className="font-semibold text-gray-900">{translateQuoteTimeline(t, req.quote.timeline)}</span>
                    </div>
                    {req.quote.notes && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs text-gray-500 mb-1">{t('proJobs.detail.labels.yourMessage')}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{req.quote.notes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {isAccepted && req.quote && (
                <>
                  <p className="text-xs text-gray-400 mb-4">
                    {t('proJobs.detail.action.acceptedBody')}
                  </p>
                  <div className="bg-green-50 rounded-md p-4 flex flex-col gap-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('proJobs.detail.labels.agreedPrice')}</span>
                      <span className="font-bold text-gray-900">{req.quote.price}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('proJobs.detail.labels.start')}</span>
                      <span className="font-semibold text-gray-900">{translateQuoteTimeline(t, req.quote.timeline)}</span>
                    </div>
                  </div>
                  {req.appointmentRequest && (
                    <div className="mt-3 bg-sky-50 border border-sky-100 rounded-md p-3 text-sm">
                      <p className="text-xs font-bold text-sky-700 mb-1">{t('proJobs.detail.appointment.proposed')}</p>
                      <p className="font-semibold text-gray-900">
                        {formatAppointmentDateTime(
                          locale,
                          t,
                          req.appointmentRequest.date,
                          req.appointmentRequest.time
                        )}
                      </p>
                      <p className="text-gray-500">{translateDuration(t, req.appointmentRequest.duration)}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(true)}
                    className="mt-3 w-full bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-md py-3 text-base transition-colors cursor-pointer border-none"
                    style={dg}
                  >
                    {req.appointmentRequest ? t('proJobs.detail.appointment.update') : t('proJobs.detail.appointment.schedule')}
                  </button>
                  {req.completion?.status === 'pro_marked_complete' ? (
                    <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-4 py-3">
                      {t('proJobs.detail.completion.waiting')}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleMarkComplete}
                      className="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-md py-3 text-base transition-colors cursor-pointer border-none"
                      style={dg}
                    >
                      {t('proJobs.detail.completion.markComplete')}
                    </button>
                  )}
                </>
              )}

              {req.status === 'declined' && (
                <p className="text-xs text-gray-400 mt-1">{t('proJobs.card.declined')}</p>
              )}
              {req.status === 'cancelled' && (
                <p className="text-xs text-gray-400 mt-1">
                  {req.cancelReason
                    ? t('proJobs.detail.action.cancelledWithReason', { reason: req.cancelReason })
                    : t('proJobs.card.cancelled')}
                </p>
              )}
              {req.status === 'completed' && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-4 py-3">
                  {t('proJobs.card.completed')}
                </p>
              )}
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="mt-3 w-full border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-md py-2.5 text-sm transition-colors cursor-pointer bg-white"
                >
                  {t('proJobs.detail.cancelModal.submit')}
                </button>
              )}
              <ReportUserButton
                targetUid={req.customerUid}
                targetRole="customer"
                targetName={customerName}
                reporterRole="pro"
                contextType="request"
                requestId={requestId}
                buttonLabel={t('proJobs.detail.action.reportCustomer')}
                className="mt-3 w-full border border-red-100 text-red-600 hover:bg-red-50 font-medium rounded-md py-2.5 text-sm transition-colors cursor-pointer bg-white"
              />
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proJobs.detail.context.kicker')}</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>
                {customerName}
              </h2>
              <div className="divide-y divide-gray-100">
                {[
                  [t('proJobs.detail.context.requestAge'), requestAgeLabel(t, req.createdAt)],
                  [t('proJobs.detail.context.location'), req.jobLocation ? `${locationSummary}${req.customerDistrict ? ` · ${mapLabel}` : ''}` : req.customerDistrict ? mapLabel : t('proJobs.location.notShared')],
                  [t('proJobs.detail.context.contact'), isAccepted ? t('proJobs.detail.context.contactAvailable') : t('proJobs.detail.context.contactHidden')],
                  [
                    t('proJobs.detail.context.detailLevel'),
                    details.length > 0
                      ? t(
                          details.length === 1
                            ? 'proJobs.detail.context.answerProvidedSingular'
                            : 'proJobs.detail.context.answerProvidedPlural',
                          { count: details.length }
                        )
                      : t('proJobs.detail.context.limitedDetail'),
                  ],
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
                    <div key={key} className="rounded-md bg-gray-50 border border-gray-100 p-3">
                      <p className="text-xs text-gray-400 mb-1">{formatKey(t, key)}</p>
                      <p className="text-sm font-semibold text-gray-900">{formatVal(t, value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checklist to help decision — only while pending */}
            {isPending && (
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proJobs.detail.tips.title')}</h2>
                <ul className="flex flex-col gap-2.5 text-sm text-gray-600">
                  {tips.map(tip => (
                    <li key={tip} className="flex items-start gap-2">
                      <span className="text-sky-400 flex-shrink-0 mt-0.5">○</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tips — only while pending */}
            {isPending && (
              <div className="bg-sky-50 border border-sky-100 rounded-lg p-4">
                <p className="text-xs font-bold text-sky-700 mb-1">{t('proJobs.detail.respondQuickly.title')}</p>
                <p className="text-xs text-sky-600 leading-relaxed">
                  {t('proJobs.detail.respondQuickly.body')}
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

'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter, useParams } from 'next/navigation'
import { MdLocationOn, MdStar } from 'react-icons/md'
import { onAuthChange, waitForAuthReady } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { acceptServiceQuote, confirmAppointment, declineServiceQuote } from '@/firebase/conversations'
import { cancelServiceRequest, confirmServiceRequestComplete } from '@/firebase/serviceRequests'
import {
  approximateRadiusMeters,
  dg,
  districtLabel,
  fetchProSummary,
  formatAnswers,
  requestCoords,
  timestampMillis,
  type ProSummary,
  type ServiceRequest,
} from '../shared'
import styles from '../../account/account.module.css'
import { ProDetailCard } from '../components/ProCard'
import ReportUserButton from '@/app/components/reports/ReportUserButton'
import StatusTimeline from '../components/StatusTimeline'
import { AcceptQuoteModal, DeclineQuoteModal } from '../QuoteDecisionModals'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type Translator = ReturnType<typeof useTranslations>

const DistrictMap = dynamic(() => import('@/app/components/DistrictMap'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />,
})

const CANCELLATION_REASONS = [
  { value: 'Schedule no longer works', labelKey: 'schedule' },
  { value: 'I found another pro', labelKey: 'anotherPro' },
  { value: 'Project is no longer needed', labelKey: 'notNeeded' },
  { value: 'Price or scope changed', labelKey: 'scopeChanged' },
  { value: 'I could not coordinate with the pro', labelKey: 'couldNotCoordinate' },
  { value: 'Other', labelKey: 'other' },
]

function requestStatusLabel(t: Translator, status: ServiceRequest['status'], declinedBy?: 'pro' | 'customer'): string {
  if (status === 'declined' && declinedBy === 'customer') return t('customerRequests.status.youDeclined')
  if (status === 'declined' && declinedBy === 'pro') return t('customerRequests.status.declinedByPro')
  return t(`customerRequests.status.${status}`)
}

function timeAgo(t: Translator, ts: ServiceRequest['createdAt']): string {
  const millis = timestampMillis(ts)
  if (!millis || Number.isNaN(millis)) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return t('customerRequests.time.justNow')
  if (seconds < 3600) return t('customerRequests.time.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('customerRequests.time.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('customerRequests.time.daysAgo', { count: Math.floor(seconds / 86400) })
}

function locationLabel(t: Translator, req: ServiceRequest, mapLabel: string): string {
  if (req.jobLocation?.accuracy) {
    const meters = approximateRadiusMeters(req.jobLocation)
    if (meters >= 1000) return t('customerRequests.detail.location.withinKm', { distance: (meters / 1000).toFixed(1) })
    return t('customerRequests.detail.location.withinMeters', { distance: meters })
  }
  if (req.jobLocation) return t('customerRequests.detail.location.approximate')
  if (req.customerDistrict) return t('customerRequests.detail.location.approximateArea', { district: mapLabel })
  return t('customerRequests.detail.location.budapestUnspecified')
}

function StatusBanner({ req }: { req: ServiceRequest }) {
  const t = useTranslations()
  const label = requestStatusLabel(t, req.status, req.declinedBy)
  const colors: Record<string, string> = {
    pending: 'bg-orange-50 text-orange-800 border-orange-200',
    quoted: 'bg-slate-50 text-slate-800 border-slate-200',
    accepted: 'bg-slate-800 text-white border-slate-800',
    declined: 'bg-gray-100 text-gray-600 border-gray-200',
    completed: 'bg-slate-800 text-white border-slate-800',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm font-semibold text-center ${colors[req.status]}`}>
      {label}
    </div>
  )
}

function CancelRequestModal({
  proName,
  appointmentLabel,
  onClose,
  onConfirm,
}: {
  proName: string
  appointmentLabel?: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const t = useTranslations()
  const [reason, setReason] = useState(CANCELLATION_REASONS[0].value)
  const [details, setDetails] = useState('')
  const [needsFollowUp, setNeedsFollowUp] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setConfirming(true)
    try {
      const selectedReason = CANCELLATION_REASONS.find(option => option.value === reason)
      const reasonLabel = selectedReason
        ? t(`customerRequests.detail.cancelModal.reasons.${selectedReason.labelKey}`)
        : reason
      const note = [
        `${t('customerRequests.detail.cancelModal.reasonPrefix')}: ${reasonLabel}`,
        details.trim() ? `${t('customerRequests.detail.cancelModal.detailsPrefix')}: ${details.trim()}` : '',
        needsFollowUp ? t('customerRequests.detail.cancelModal.supportRequested') : '',
      ].filter(Boolean).join('\n')
      await onConfirm(note)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('customerRequests.detail.cancelModal.error'))
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">{t('customerRequests.detail.cancelModal.kicker')}</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {t('customerRequests.detail.cancelModal.title', { name: proName })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer shrink-0 p-1"
            aria-label={t('customerRequests.detail.common.close')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-500 -mt-1">
            {t('customerRequests.detail.cancelModal.body', { name: proName })}
            {appointmentLabel ? ` ${t('customerRequests.detail.cancelModal.currentAppointment', { appointment: appointmentLabel })}` : ''}
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-reason" className="text-sm font-bold text-gray-700">
              {t('customerRequests.detail.cancelModal.reasonLabel')}
            </label>
            <select
              id="cancel-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              {CANCELLATION_REASONS.map(option => (
                <option key={option.value} value={option.value}>
                  {t(`customerRequests.detail.cancelModal.reasons.${option.labelKey}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-details" className="text-sm font-bold text-gray-700">
              {t('customerRequests.detail.cancelModal.detailsLabel')} <span className="text-gray-400 font-normal">{t('customerRequests.detail.common.optional')}</span>
            </label>
            <textarea
              id="cancel-details"
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={4}
              placeholder={t('customerRequests.detail.cancelModal.detailsPlaceholder')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={needsFollowUp}
              onChange={e => setNeedsFollowUp(e.target.checked)}
              className="mt-0.5"
            />
            {t('customerRequests.detail.cancelModal.followUp')}
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm cursor-pointer bg-white"
            >
              {t('customerRequests.detail.cancelModal.keep')}
            </button>
            <button
              type="submit"
              disabled={confirming}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black rounded-xl py-3 text-sm cursor-pointer border-none"
              style={dg}
            >
              {confirming ? t('customerRequests.detail.cancelModal.cancelling') : t('customerRequests.detail.cancelModal.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NeedHelpCard({ requestId, status, proName }: { requestId: string; status: ServiceRequest['status']; proName: string }) {
  const t = useTranslations()
  const subject = encodeURIComponent(t('customerRequests.detail.help.emailSubject', { id: requestId }))
  const body = encodeURIComponent([
    `${t('customerRequests.detail.help.requestId')}: ${requestId}`,
    `${t('customerRequests.detail.help.status')}: ${requestStatusLabel(t, status)}`,
    `${t('customerRequests.detail.help.pro')}: ${proName}`,
    '',
    t('customerRequests.detail.help.prompt'),
  ].join('\n'))

  return (
    <section className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
      <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('customerRequests.detail.help.kicker')}</p>
      <h2 className="font-black text-gray-900 text-xl leading-none mb-2" style={dg}>
        {t('customerRequests.detail.help.title')}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        {t('customerRequests.detail.help.body')}
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={`mailto:support@mestermind.com?subject=${subject}&body=${body}`}
          className="block w-full rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600"
        >
          {t('customerRequests.detail.help.email')}
        </a>
        <Link
          href="/help"
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {t('customerRequests.detail.help.helpCenter')}
        </Link>
      </div>
    </section>
  )
}

function ReviewCard({
  requestId,
  proName,
  existingReview,
  onReviewed,
}: {
  requestId: string
  proName: string
  existingReview?: ServiceRequest['review']
  onReviewed: () => Promise<void>
}) {
  const t = useTranslations()
  const [rating, setRating] = useState(existingReview?.rating ?? 5)
  const [comment, setComment] = useState(existingReview?.comment ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await authenticatedFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ requestId, rating, comment }),
      })
      await onReviewed()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('customerRequests.detail.review.error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (existingReview) {
    return (
      <section id="review" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm scroll-mt-24">
        <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('customerRequests.detail.review.yourReview')}</p>
        <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
          {t('customerRequests.detail.review.thanks', { name: proName })}
        </h2>
        <div className="mb-3 flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map(value => (
            <MdStar key={value} size={20} color={value <= existingReview.rating ? '#f97316' : '#d1d5db'} />
          ))}
          <span className="ml-1 text-sm font-bold text-gray-700">{existingReview.rating}/5</span>
        </div>
        <p className="whitespace-pre-wrap rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm leading-6 text-gray-700">
          {existingReview.comment}
        </p>
      </section>
    )
  }

  return (
    <section id="review" className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-sm scroll-mt-24">
      <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('customerRequests.detail.review.kicker')}</p>
      <h2 className="font-black text-gray-900 text-2xl leading-none mb-2" style={dg}>
        {t('customerRequests.detail.review.title', { name: proName })}
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        {t('customerRequests.detail.review.body')}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">{t('customerRequests.detail.review.rating')}</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="border-none bg-transparent p-0.5 cursor-pointer"
                aria-label={t(value === 1 ? 'customerRequests.detail.review.starSingular' : 'customerRequests.detail.review.starPlural', { count: value })}
              >
                <MdStar size={30} color={value <= rating ? '#f97316' : '#d1d5db'} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="review-comment" className="block text-sm font-bold text-gray-700 mb-2">
            {t('customerRequests.detail.review.commentLabel')}
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
            maxLength={1200}
            placeholder={t('customerRequests.detail.review.commentPlaceholder')}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">{t('customerRequests.detail.review.minimum')}</p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting || comment.trim().length < 20}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl py-3 text-base cursor-pointer disabled:cursor-not-allowed border-none"
          style={dg}
        >
          {submitting ? t('customerRequests.detail.review.submitting') : t('customerRequests.detail.review.submit')}
        </button>
      </form>
    </section>
  )
}

function formatAppointmentDateTime(date: string, time: string, locale: string, t: Translator): string {
  if (!date || !time) return [date, time].filter(Boolean).join(` ${t('customerRequests.detail.common.at')} `)
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} ${t('customerRequests.detail.common.at')} ${time}`
  return parsed.toLocaleString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function loginUrlFor(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`
}

export default function RequestDetailPage() {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const requestId = params.requestId as string
  const [req, setReq] = useState<ServiceRequest | null>(null)
  const [pro, setPro] = useState<ProSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAccept, setShowAccept] = useState(false)
  const [showDecline, setShowDecline] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [hasConversation, setHasConversation] = useState(false)

  const loadCurrentRequest = useCallback(async () => {
    const response = await authenticatedFetch(`/api/service-requests/${requestId}`)
    const data = (await response.json()) as { request?: ServiceRequest; hasConversation?: boolean }
    if (!data.request) return null
    setHasConversation(Boolean(data.hasConversation))
    return data.request
  }, [requestId])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    async function loadRequestForUser() {
      await waitForAuthReady()
      if (cancelled) return

      unsubscribe = onAuthChange(async user => {
        const nextPath = `/requests/${requestId}`
        if (!user) {
          router.replace(loginUrlFor(nextPath))
          return
        }
        try {
          const data = await loadCurrentRequest()
          if (!data) {
            setReq(null)
            setLoading(false)
            return
          }
          if (data.customerUid !== user.uid) {
            router.replace(loginUrlFor(nextPath))
            return
          }
          setReq(data)
          setPro(await fetchProSummary(data.proUid))
        } catch {
          setReq(null)
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
  }, [loadCurrentRequest, router, requestId])

  async function handleAccept(input: Parameters<typeof acceptServiceQuote>[2]) {
    if (!req) return
    await acceptServiceQuote(requestId, req.customerUid, input)
    const updated = await loadCurrentRequest()
    if (updated) setReq(updated)
    setShowAccept(false)
    setHasConversation(true)
    router.push(`/messages/${requestId}`)
  }

  async function handleDecline(reason: string) {
    if (!req) return
    await declineServiceQuote(requestId, req.customerUid, reason)
    const updated = await loadCurrentRequest()
    if (updated) setReq(updated)
    setShowDecline(false)
  }

  async function handleConfirmAppointment() {
    if (!req?.appointmentRequest && !req?.appointmentChangeRequest) return
    await confirmAppointment(requestId, req.customerUid)
    if (req.appointmentChangeRequest) {
      const { appointmentChangeRequest, ...rest } = req
      setReq({
        ...rest,
        appointmentRequest: {
          ...appointmentChangeRequest,
          status: 'confirmed',
          confirmedAt: null,
        },
      })
    } else if (req.appointmentRequest) {
      setReq({
        ...req,
        appointmentRequest: {
          ...req.appointmentRequest,
          status: 'confirmed',
          confirmedAt: null,
        },
      })
    }
  }

  async function handleConfirmComplete() {
    if (!req) return
    await confirmServiceRequestComplete(requestId)
    const updated = await loadCurrentRequest()
    if (updated) setReq(updated)
  }

  async function refreshRequest() {
    const updated = await loadCurrentRequest()
    if (updated) setReq(updated)
  }

  async function handleCancel(reason: string) {
    if (!req) return
    await cancelServiceRequest(requestId, reason)
    const updated = await loadCurrentRequest()
    if (updated) setReq(updated)
    setShowCancel(false)
  }

  if (loading) {
    return (
      <main className="bg-gray-50 min-h-screen flex-1">
        <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-4">
              <div className="h-72 bg-gray-200 rounded-2xl" />
              <div className="h-48 bg-gray-200 rounded-2xl" />
            </div>
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl" />
          </div>
        </div>
      </main>
    )
  }

  if (!req) {
    return (
      <main className="bg-gray-50 min-h-screen flex-1">
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>{t('customerRequests.detail.notFound.title')}</p>
          <Link href="/requests" className="inline-block mt-4 text-orange-600 font-semibold hover:underline">
            {t('customerRequests.detail.notFound.back')}
          </Link>
        </div>
      </main>
    )
  }

  const details = formatAnswers(req.answers)
  const [lat, lng] = requestCoords(req)
  const mapLabel = req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
  const locationSummary = locationLabel(t, req, mapLabel)
  const displayName = pro?.fullName ?? req.proName
  const isQuoted = req.status === 'quoted'
  const isAccepted = req.status === 'accepted'
  const hasConfirmedAppointment = req.appointmentRequest?.status === 'confirmed'
  const canCancel = req.status === 'pending' || req.status === 'quoted' || req.status === 'accepted'

  return (
    <main className="bg-gray-50 min-h-screen flex-1 pb-16">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link
          href="/requests"
          className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex items-center gap-1"
        >
          {t('customerRequests.detail.back')}
        </Link>

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('customerRequests.detail.header.kicker')}</p>
          <h1 className="text-4xl font-black text-gray-900 leading-tight" style={{ ...dg, letterSpacing: '-0.02em' }}>
            {translateCategory(t, req.categoryName)}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('customerRequests.detail.header.withPro', { name: displayName, time: timeAgo(t, req.createdAt) })}
          </p>
        </div>

        <div className="mb-6">
          <StatusBanner req={req} />
        </div>

        <div className="mb-8">
          <StatusTimeline status={req.status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="lg:col-span-3 flex flex-col gap-5">
            {req.status === 'completed' && (
              <ReviewCard
                requestId={requestId}
                proName={displayName}
                existingReview={req.review}
                onReviewed={refreshRequest}
              />
            )}

            {isQuoted && req.quote && (
              <section className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm">
                <h2 className="font-black text-slate-800 text-lg mb-3" style={dg}>{t('customerRequests.detail.quote.ready', { name: displayName })}</h2>
                <p className="text-3xl font-black text-gray-900 mb-1" style={dg}>{req.quote.price}</p>
                {req.quote.timeline && (
                  <p className="text-sm text-gray-600 mb-4">{t('customerRequests.detail.quote.proCanStart', { timeline: req.quote.timeline })}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAccept(true)}
                    className={`flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl py-3 text-base cursor-pointer border-none ${styles.quotePulseButton}`}
                    style={dg}
                  >
                    {t('customerRequests.detail.quote.accept')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDecline(true)}
                    className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm cursor-pointer bg-white"
                  >
                    {t('customerRequests.detail.quote.decline')}
                  </button>
                </div>
              </section>
            )}

            {isAccepted && req.completion?.status === 'pro_marked_complete' && (
              <section className="bg-white rounded-2xl border-2 border-green-200 p-5 shadow-sm">
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
                  {t('customerRequests.detail.completion.title')}
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  {t('customerRequests.detail.completion.body', { name: displayName })}
                </p>
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl py-3 text-base cursor-pointer border-none"
                  style={dg}
                >
                  {t('customerRequests.detail.completion.confirm')}
                </button>
              </section>
            )}

            {isAccepted && req.appointmentRequest && (
              <section className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">
                  {t('customerRequests.detail.appointment.kicker')}
                </p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
                  {req.appointmentRequest.status === 'confirmed'
                    ? t('customerRequests.detail.appointment.confirmedTitle')
                    : t('customerRequests.detail.appointment.confirmTitle')}
                </h2>
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 mb-4">
                  <p className="text-sm font-bold text-orange-700 mb-1">
                    {req.appointmentRequest.kind === 'quote' ? t('customerRequests.detail.appointment.quoteVisit') : t('customerRequests.detail.appointment.serviceAppointment')}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatAppointmentDateTime(
                      req.appointmentRequest.date,
                      req.appointmentRequest.time,
                      locale,
                      t
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{req.appointmentRequest.duration}</p>
                  {req.appointmentRequest.location && (
                    <p className="text-sm text-gray-600 mt-2">{req.appointmentRequest.location}</p>
                  )}
                  {req.appointmentRequest.notes && (
                    <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{req.appointmentRequest.notes}</p>
                  )}
                </div>
                {req.appointmentRequest.status === 'confirmed' && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 mb-4">
                    <h3 className="font-black text-slate-800 text-xl leading-none mb-3" style={dg}>
                      {t('customerRequests.detail.appointment.hired', { name: displayName })}
                    </h3>
                    {req.quote?.price && (
                      <div className="rounded-lg bg-white border border-slate-100 px-4 py-3 mb-4">
                        <dt className="text-sm text-gray-500">{t('customerRequests.detail.appointment.quotedPrice')}</dt>
                        <dd className="font-black text-2xl text-gray-900" style={dg}>{req.quote.price}</dd>
                      </div>
                    )}
                    {req.acceptance && (
                      <dl className="space-y-2 text-sm">
                        {req.acceptance.phone && (
                          <div>
                            <dt className="text-gray-500">{t('customerRequests.detail.appointment.phone')}</dt>
                            <dd className="font-semibold text-gray-900">{req.acceptance.phone}</dd>
                          </div>
                        )}
                        {req.acceptance.address && (
                          <div>
                            <dt className="text-gray-500">{t('customerRequests.detail.appointment.address')}</dt>
                            <dd className="font-semibold text-gray-900">{req.acceptance.address}</dd>
                          </div>
                        )}
                        {req.acceptance.preferredStart && (
                          <div>
                            <dt className="text-gray-500">{t('customerRequests.detail.appointment.preferredStart')}</dt>
                            <dd className="font-semibold text-gray-900">{req.acceptance.preferredStart}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-gray-500">{t('customerRequests.detail.appointment.yourMessage')}</dt>
                          <dd className="text-gray-800 whitespace-pre-wrap">{req.acceptance.message}</dd>
                        </div>
                      </dl>
                    )}
                  </div>
                )}
                {req.appointmentRequest.status === 'proposed' ? (
                  <button
                    type="button"
                    onClick={handleConfirmAppointment}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-3 text-base cursor-pointer border-none"
                    style={dg}
                  >
                    {t('customerRequests.detail.appointment.confirmButton')}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setShowCancel(true)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                      >
                        {t('customerRequests.detail.appointment.cancelButton')}
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {isAccepted && req.appointmentChangeRequest && (
              <section className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">
                  {t('customerRequests.detail.appointment.changeKicker')}
                </p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
                  {t('customerRequests.detail.appointment.changeTitle')}
                </h2>
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 mb-4">
                  <p className="text-sm font-bold text-orange-700 mb-1">
                    {req.appointmentChangeRequest.kind === 'quote' ? t('customerRequests.detail.appointment.quoteVisit') : t('customerRequests.detail.appointment.serviceAppointment')}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatAppointmentDateTime(
                      req.appointmentChangeRequest.date,
                      req.appointmentChangeRequest.time,
                      locale,
                      t
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{req.appointmentChangeRequest.duration}</p>
                  {req.appointmentChangeRequest.location && (
                    <p className="text-sm text-gray-600 mt-2">{req.appointmentChangeRequest.location}</p>
                  )}
                  {req.appointmentChangeRequest.notes && (
                    <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{req.appointmentChangeRequest.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleConfirmAppointment}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-3 text-base cursor-pointer border-none"
                  style={dg}
                >
                  {t('customerRequests.detail.appointment.approveChange')}
                </button>
              </section>
            )}

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-black text-gray-900 text-lg mb-1 flex items-center gap-2" style={dg}>
                <MdLocationOn className="text-slate-800" size={22} />
                {t('customerRequests.detail.location.title')}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {locationSummary}
              </p>
              <DistrictMap
                lat={lat}
                lng={lng}
                districtLabel={locationSummary}
                height={280}
                radius={approximateRadiusMeters(req.jobLocation)}
                popupText={locationSummary}
              />
              <p className="text-xs text-gray-400 mt-3">
                {isAccepted
                  ? t('customerRequests.detail.location.acceptedNote')
                  : t('customerRequests.detail.location.pendingNote')}
              </p>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-black text-gray-900 text-lg mb-4" style={dg}>{t('customerRequests.detail.project.title')}</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-full px-3 py-1">
                  {translateCategory(t, req.categoryName)}
                </span>
                {req.customerDistrict && (
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold rounded-full px-3 py-1">
                    {t('customerRequests.detail.project.district', { district: req.customerDistrict })}
                  </span>
                )}
              </div>
              {details.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {details.map(({ key, value }) => (
                    <div key={key} className="py-3 flex justify-between gap-4 items-start">
                      <span className="text-sm text-gray-500">{key}</span>
                      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t('customerRequests.detail.project.noDetails')}</p>
              )}
            </section>

            {req.quote && !hasConfirmedAppointment && (req.status === 'quoted' || req.status === 'accepted' || req.status === 'completed') && (
              <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-black text-slate-800 text-lg mb-3" style={dg}>{t('customerRequests.detail.quote.fromPro', { name: displayName })}</h2>
                <p className="text-2xl font-black text-gray-900" style={dg}>{req.quote.price}</p>
                {req.quote.timeline && (
                  <p className="text-sm text-gray-600 mt-2">{t('customerRequests.detail.quote.timeline', { timeline: req.quote.timeline })}</p>
                )}
                {req.quote.notes && (
                  <p className="text-sm text-gray-700 mt-3 p-3 bg-slate-50 rounded-lg whitespace-pre-wrap">
                    {req.quote.notes}
                  </p>
                )}
              </section>
            )}

            {req.status === 'pending' && (
              <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3 text-sm text-orange-800">
                {t('customerRequests.detail.pendingResponse', { name: displayName })}
              </div>
            )}

            {req.status === 'declined' && req.declinedBy === 'customer' && req.declineReason && (
              <p className="text-sm text-gray-500">{t('customerRequests.detail.notes.yourNote', { note: req.declineReason })}</p>
            )}

            {req.status === 'cancelled' && req.cancelReason && (
              <p className="text-sm text-gray-500">{t('customerRequests.detail.notes.cancellationNote', { note: req.cancelReason })}</p>
            )}
          </div>

          <div className="lg:col-span-2 lg:sticky lg:top-6 flex flex-col gap-4">
            {pro ? (
              <ProDetailCard pro={pro} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="font-bold text-gray-900" style={dg}>{req.proName}</p>
                <Link href={`/pro/${req.proUid}`} className="mt-4 block text-center py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold">
                  {t('customerRequests.detail.sidebar.viewProfile')}
                </Link>
              </div>
            )}
            {hasConversation && !hasConfirmedAppointment && (
              <Link
                href={`/messages/${requestId}`}
                className="block w-full rounded-xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-900"
              >
                {t('customerRequests.detail.sidebar.openConversation')}
              </Link>
            )}
            {canCancel && !hasConfirmedAppointment && (
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                {t('customerRequests.detail.sidebar.cancelRequest')}
              </button>
            )}
            <ReportUserButton
              targetUid={req.proUid}
              targetRole="pro"
              targetName={displayName}
              reporterRole="customer"
              contextType="request"
              requestId={requestId}
              buttonLabel={t('customerRequests.detail.sidebar.reportPro')}
            />
            <NeedHelpCard requestId={requestId} status={req.status} proName={displayName} />
          </div>
        </div>
      </div>

      {showAccept && (
        <AcceptQuoteModal
          proName={displayName}
          onClose={() => setShowAccept(false)}
          onSubmit={handleAccept}
        />
      )}
      {showDecline && (
        <DeclineQuoteModal
          proName={displayName}
          onClose={() => setShowDecline(false)}
          onConfirm={handleDecline}
        />
      )}
      {showCancel && (
        <CancelRequestModal
          proName={displayName}
          appointmentLabel={req.appointmentRequest
            ? formatAppointmentDateTime(req.appointmentRequest.date, req.appointmentRequest.time, locale, t)
            : undefined}
          onClose={() => setShowCancel(false)}
          onConfirm={handleCancel}
        />
      )}
    </main>
  )
}

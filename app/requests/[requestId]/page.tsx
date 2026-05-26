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
  approximateLocationLabel,
  approximateRadiusMeters,
  dg,
  districtLabel,
  fetchProSummary,
  formatAnswers,
  requestCoords,
  requestStatusLabel,
  timeAgo,
  type ProSummary,
  type ServiceRequest,
} from '../shared'
import styles from '../../account/account.module.css'
import { ProDetailCard } from '../components/ProCard'
import ReportUserButton from '@/app/components/reports/ReportUserButton'
import StatusTimeline from '../components/StatusTimeline'
import { AcceptQuoteModal, DeclineQuoteModal } from '../QuoteDecisionModals'

const DistrictMap = dynamic(() => import('@/app/components/DistrictMap'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-xl bg-gray-100 animate-pulse" />,
})

const CANCELLATION_REASONS = [
  'Schedule no longer works',
  'I found another pro',
  'Project is no longer needed',
  'Price or scope changed',
  'I could not coordinate with the pro',
  'Other',
]

function StatusBanner({ req }: { req: ServiceRequest }) {
  const label = requestStatusLabel(req.status, req.declinedBy)
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
  const [reason, setReason] = useState(CANCELLATION_REASONS[0])
  const [details, setDetails] = useState('')
  const [needsFollowUp, setNeedsFollowUp] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setConfirming(true)
    try {
      const note = [
        `Reason: ${reason}`,
        details.trim() ? `Details: ${details.trim()}` : '',
        needsFollowUp ? 'Support follow-up requested.' : '',
      ].filter(Boolean).join('\n')
      await onConfirm(note)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel this appointment.')
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
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">Cancel appointment</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              Cancel with {proName}?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer shrink-0 p-1"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-sm text-gray-500 -mt-1">
            This cancels the request and notifies {proName}. {appointmentLabel ? `Current appointment: ${appointmentLabel}.` : ''}
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-reason" className="text-sm font-bold text-gray-700">
              Why are you cancelling?
            </label>
            <select
              id="cancel-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              {CANCELLATION_REASONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cancel-details" className="text-sm font-bold text-gray-700">
              Details for the pro <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="cancel-details"
              value={details}
              onChange={e => setDetails(e.target.value)}
              rows={4}
              placeholder="Add anything the pro should know, such as timing, scope changes, or whether you may rebook later."
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
            I need Mestermind support to follow up about this cancellation.
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm cursor-pointer bg-white"
            >
              Keep appointment
            </button>
            <button
              type="submit"
              disabled={confirming}
              className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black rounded-xl py-3 text-sm cursor-pointer border-none"
              style={dg}
            >
              {confirming ? 'Cancelling…' : 'Cancel appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NeedHelpCard({ requestId, status, proName }: { requestId: string; status: ServiceRequest['status']; proName: string }) {
  const subject = encodeURIComponent(`Help with Mestermind request ${requestId}`)
  const body = encodeURIComponent([
    `Request ID: ${requestId}`,
    `Status: ${requestStatusLabel(status)}`,
    `Pro: ${proName}`,
    '',
    'Tell us what happened:',
  ].join('\n'))

  return (
    <section className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
      <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Need help?</p>
      <h2 className="font-black text-gray-900 text-xl leading-none mb-2" style={dg}>
        We can help with this request
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Questions about quotes, scheduling, cancellations, or next steps? Include this request ID when contacting support.
      </p>
      <div className="flex flex-col gap-2">
        <a
          href={`mailto:support@mestermind.com?subject=${subject}&body=${body}`}
          className="block w-full rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600"
        >
          Email support
        </a>
        <Link
          href="/help"
          className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Visit help center
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
      setError(err instanceof Error ? err.message : 'Could not submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (existingReview) {
    return (
      <section id="review" className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm scroll-mt-24">
        <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Your review</p>
        <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
          Thanks for reviewing {proName}
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
      <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Review your pro</p>
      <h2 className="font-black text-gray-900 text-2xl leading-none mb-2" style={dg}>
        How did {proName} do?
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Your public review helps other customers choose with confidence.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(value => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="border-none bg-transparent p-0.5 cursor-pointer"
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
              >
                <MdStar size={30} color={value <= rating ? '#f97316' : '#d1d5db'} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="review-comment" className="block text-sm font-bold text-gray-700 mb-2">
            What should others know?
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={4}
            maxLength={1200}
            placeholder="Mention communication, quality, timing, value, and whether you would hire them again."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">Minimum 20 characters.</p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting || comment.trim().length < 20}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold rounded-xl py-3 text-base cursor-pointer disabled:cursor-not-allowed border-none"
          style={dg}
        >
          {submitting ? 'Submitting review…' : 'Submit review'}
        </button>
      </form>
    </section>
  )
}

function formatAppointmentDateTime(date: string, time: string): string {
  if (!date || !time) return [date, time].filter(Boolean).join(' at ')
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} at ${time}`
  return parsed.toLocaleString(undefined, {
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
          <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>Request not found</p>
          <Link href="/requests" className="inline-block mt-4 text-orange-600 font-semibold hover:underline">
            Back to my requests
          </Link>
        </div>
      </main>
    )
  }

  const details = formatAnswers(req.answers)
  const [lat, lng] = requestCoords(req)
  const mapLabel = req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
  const locationSummary = req.jobLocation
    ? approximateLocationLabel(req.jobLocation)
    : req.customerDistrict
    ? `Approximate area: ${mapLabel}`
    : 'Budapest — district not specified'
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
          ← My requests
        </Link>

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Your project</p>
          <h1 className="text-4xl font-black text-gray-900 leading-tight" style={{ ...dg, letterSpacing: '-0.02em' }}>
            {req.categoryName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            with {displayName} · {timeAgo(req.createdAt)}
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
                <h2 className="font-black text-slate-800 text-lg mb-3" style={dg}>Ready to hire {displayName}?</h2>
                <p className="text-3xl font-black text-gray-900 mb-1" style={dg}>{req.quote.price}</p>
                {req.quote.timeline && (
                  <p className="text-sm text-gray-600 mb-4">Pro can start: {req.quote.timeline}</p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAccept(true)}
                    className={`flex-1 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl py-3 text-base cursor-pointer border-none ${styles.quotePulseButton}`}
                    style={dg}
                  >
                    Accept quote
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDecline(true)}
                    className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm cursor-pointer bg-white"
                  >
                    Decline
                  </button>
                </div>
              </section>
            )}

            {isAccepted && req.completion?.status === 'pro_marked_complete' && (
              <section className="bg-white rounded-2xl border-2 border-green-200 p-5 shadow-sm">
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
                  Confirm job completion
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  {displayName} marked this job complete. Confirm once the work is finished to close the request.
                </p>
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl py-3 text-base cursor-pointer border-none"
                  style={dg}
                >
                  Confirm complete
                </button>
              </section>
            )}

            {isAccepted && req.appointmentRequest && (
              <section className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">
                  Appointment request
                </p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
                  {req.appointmentRequest.status === 'confirmed'
                    ? 'Appointment confirmed'
                    : 'Confirm your appointment'}
                </h2>
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 mb-4">
                  <p className="text-sm font-bold text-orange-700 mb-1">
                    {req.appointmentRequest.kind === 'quote' ? 'Quote visit' : 'Service appointment'}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatAppointmentDateTime(
                      req.appointmentRequest.date,
                      req.appointmentRequest.time
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
                      You hired {displayName}
                    </h3>
                    {req.quote?.price && (
                      <div className="rounded-lg bg-white border border-slate-100 px-4 py-3 mb-4">
                        <dt className="text-sm text-gray-500">Quoted price</dt>
                        <dd className="font-black text-2xl text-gray-900" style={dg}>{req.quote.price}</dd>
                      </div>
                    )}
                    {req.acceptance && (
                      <dl className="space-y-2 text-sm">
                        {req.acceptance.phone && (
                          <div>
                            <dt className="text-gray-500">Phone</dt>
                            <dd className="font-semibold text-gray-900">{req.acceptance.phone}</dd>
                          </div>
                        )}
                        {req.acceptance.address && (
                          <div>
                            <dt className="text-gray-500">Address</dt>
                            <dd className="font-semibold text-gray-900">{req.acceptance.address}</dd>
                          </div>
                        )}
                        {req.acceptance.preferredStart && (
                          <div>
                            <dt className="text-gray-500">Preferred start</dt>
                            <dd className="font-semibold text-gray-900">{req.acceptance.preferredStart}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-gray-500">Your message</dt>
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
                    Confirm appointment
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => setShowCancel(true)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
                      >
                        Cancel appointment
                      </button>
                    )}
                  </div>
                )}
              </section>
            )}

            {isAccepted && req.appointmentChangeRequest && (
              <section className="bg-white rounded-2xl border-2 border-orange-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">
                  Appointment change request
                </p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>
                  Approve the new appointment time
                </h2>
                <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 mb-4">
                  <p className="text-sm font-bold text-orange-700 mb-1">
                    {req.appointmentChangeRequest.kind === 'quote' ? 'Quote visit' : 'Service appointment'}
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {formatAppointmentDateTime(
                      req.appointmentChangeRequest.date,
                      req.appointmentChangeRequest.time
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
                  Approve change
                </button>
              </section>
            )}

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-black text-gray-900 text-lg mb-1 flex items-center gap-2" style={dg}>
                <MdLocationOn className="text-slate-800" size={22} />
                Service location
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
                  ? 'Your full address is shared with the pro in your acceptance details.'
                  : 'The pro sees this approximate area. Exact address is shared after you accept a quote.'}
              </p>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-black text-gray-900 text-lg mb-4" style={dg}>Project details</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold rounded-full px-3 py-1">
                  {req.categoryName}
                </span>
                {req.customerDistrict && (
                  <span className="bg-gray-100 text-gray-600 text-xs font-semibold rounded-full px-3 py-1">
                    District {req.customerDistrict}
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
                <p className="text-sm text-gray-400">No additional details provided.</p>
              )}
            </section>

            {req.quote && !hasConfirmedAppointment && (req.status === 'quoted' || req.status === 'accepted' || req.status === 'completed') && (
              <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-black text-slate-800 text-lg mb-3" style={dg}>Quote from {displayName}</h2>
                <p className="text-2xl font-black text-gray-900" style={dg}>{req.quote.price}</p>
                {req.quote.timeline && (
                  <p className="text-sm text-gray-600 mt-2">Timeline: {req.quote.timeline}</p>
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
                <strong>{displayName}</strong> typically responds within a few hours.
              </div>
            )}

            {req.status === 'declined' && req.declinedBy === 'customer' && req.declineReason && (
              <p className="text-sm text-gray-500">Your note: {req.declineReason}</p>
            )}

            {req.status === 'cancelled' && req.cancelReason && (
              <p className="text-sm text-gray-500">Cancellation note: {req.cancelReason}</p>
            )}
          </div>

          <div className="lg:col-span-2 lg:sticky lg:top-6 flex flex-col gap-4">
            {pro ? (
              <ProDetailCard pro={pro} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="font-bold text-gray-900" style={dg}>{req.proName}</p>
                <Link href={`/pro/${req.proUid}`} className="mt-4 block text-center py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold">
                  View profile
                </Link>
              </div>
            )}
            {hasConversation && !hasConfirmedAppointment && (
              <Link
                href={`/messages/${requestId}`}
                className="block w-full rounded-xl bg-slate-800 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-900"
              >
                Open conversation
              </Link>
            )}
            {canCancel && !hasConfirmedAppointment && (
              <button
                type="button"
                onClick={() => setShowCancel(true)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel request
              </button>
            )}
            <ReportUserButton
              targetUid={req.proUid}
              targetRole="pro"
              targetName={displayName}
              reporterRole="customer"
              contextType="request"
              requestId={requestId}
              buttonLabel="Report this pro"
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
            ? formatAppointmentDateTime(req.appointmentRequest.date, req.appointmentRequest.time)
            : undefined}
          onClose={() => setShowCancel(false)}
          onConfirm={handleCancel}
        />
      )}
    </main>
  )
}

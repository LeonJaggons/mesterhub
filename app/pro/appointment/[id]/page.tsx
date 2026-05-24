'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { MdCancel, MdCheckCircle, MdMap, MdMessage, MdSchedule, MdWork } from 'react-icons/md'
import { db } from '@/firebase/index'
import { onAuthChange } from '@/firebase/auth'
import { requestAppointment, type AppointmentRequestInput } from '@/firebase/conversations'
import {
  approximateLocationLabel,
  approximateRadiusMeters,
  appointmentCoords,
  districtLabel,
} from '@/app/requests/shared'
import {
  cancelServiceRequest,
  markServiceRequestComplete,
  type JobLocation,
  type ServiceRequestStatus,
} from '@/firebase/serviceRequests'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const actionButtonBase = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold leading-5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
const primaryActionButton = `${actionButtonBase} border border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:border-orange-600`
const darkActionButton = `${actionButtonBase} border border-slate-800 bg-slate-800 text-white hover:bg-slate-900 hover:border-slate-900`
const secondaryActionButton = `${actionButtonBase} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`
const dangerActionButton = `${actionButtonBase} border border-gray-300 bg-white text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700`

const DistrictMap = dynamic(() => import('@/app/components/DistrictMap'), {
  ssr: false,
  loading: () => <div className="h-72 rounded-xl bg-gray-100 animate-pulse" />,
})

type AppointmentRequest = {
  kind: 'quote' | 'service'
  date: string
  time: string
  duration: string
  location: string
  jobLocation?: JobLocation | null
  notes: string
  status: 'proposed' | 'confirmed'
  requestedAt: Timestamp | null
  confirmedAt?: Timestamp | null
}

type ServiceRequest = {
  id: string
  projectId?: string
  proUid: string
  categoryName: string
  customerName?: string
  customerEmail?: string
  customerDistrict?: string
  jobLocation?: JobLocation
  answers?: Record<string, string>
  status: ServiceRequestStatus
  quote?: { price?: string; timeline?: string; notes?: string }
  acceptance?: { address?: string; phone?: string; preferredStart?: string; message?: string }
  appointmentRequest?: AppointmentRequest
  appointmentChangeRequest?: AppointmentRequest
  completion?: { status?: 'pro_marked_complete' | 'confirmed_complete' }
  cancelReason?: string
  createdAt: Timestamp | null
}

function formatAppointmentDateTime(date: string, time: string): string {
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

function formatAnswers(answers?: Record<string, string>) {
  return Object.entries(answers ?? {})
    .filter(([, v]) => v)
    .map(([key, value]) => ({
      key: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }))
}

function districtCopy(req: ServiceRequest): string {
  return req.customerDistrict ? districtLabel(req.customerDistrict) : 'District not shared'
}

function appointmentStart(appointment: AppointmentRequest): Date | null {
  const parsed = new Date(`${appointment.date}T${appointment.time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function durationMinutes(duration: string): number {
  if (duration === 'Half day') return 240
  if (duration === 'Full day') return 480
  const match = duration.match(/(\d+)/)
  if (!match) return 60
  const amount = Number(match[1])
  return duration.includes('hour') ? amount * 60 : amount
}

function appointmentStage(appointment: AppointmentRequest): number {
  if (appointment.status !== 'confirmed') return 0

  const start = appointmentStart(appointment)
  if (!start) return 1

  const now = new Date()
  const end = new Date(start.getTime() + durationMinutes(appointment.duration) * 60000)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfAppointmentDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())

  if (now > end) return 4
  if (now >= start && now <= end) return 3
  if (startOfAppointmentDay.getTime() === startOfToday.getTime()) return 2
  return 1
}

function mapsUrl(req: ServiceRequest, appointment: AppointmentRequest): string {
  const location = appointment.jobLocation ?? req.jobLocation
  if (!appointment.location && location) {
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
  }
  const query = appointment.location || districtCopy(req) || 'Budapest'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function canCancel(status: ServiceRequestStatus): boolean {
  return status === 'pending' || status === 'quoted' || status === 'accepted'
}

function actionStatusCopy(req: ServiceRequest): string {
  if (req.status === 'completed') return 'The customer confirmed this job is complete.'
  if (req.status === 'cancelled') return req.cancelReason ? `This request was cancelled: ${req.cancelReason}` : 'This request was cancelled.'
  if (req.completion?.status === 'pro_marked_complete') return 'Waiting for the customer to confirm completion.'
  if (req.appointmentChangeRequest?.status === 'proposed') return 'Appointment change sent. Waiting for customer confirmation.'
  return 'Use these actions to manage the appointment from here.'
}

function RescheduleModal({
  req,
  appointment,
  onClose,
  onSubmit,
}: {
  req: ServiceRequest
  appointment: AppointmentRequest
  onClose: () => void
  onSubmit: (input: AppointmentRequestInput) => Promise<void>
}) {
  const [kind, setKind] = useState<AppointmentRequestInput['kind']>(appointment.kind)
  const [date, setDate] = useState(appointment.date)
  const [time, setTime] = useState(appointment.time)
  const [duration, setDuration] = useState(appointment.duration || '60 minutes')
  const [location, setLocation] = useState(appointment.location || req.acceptance?.address || '')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!date || !time) {
      setError('Choose a date and time.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({
        kind,
        date,
        time,
        duration,
        location: location.trim(),
        notes: notes.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send appointment change.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={onClose}>
      <div className="w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">Appointment change</p>
            <h2 className="text-2xl font-black text-gray-900" style={dg}>Propose a new time</h2>
            <p className="mt-1 text-sm text-gray-500">The customer must confirm before this replaces the current appointment.</p>
          </div>
          <button type="button" onClick={onClose} className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Date
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Time
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              Duration
              <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100">
                {['30 minutes', '60 minutes', '90 minutes', '2 hours', 'Half day', 'Full day'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Appointment type
            <select value={kind} onChange={e => setKind(e.target.value as AppointmentRequestInput['kind'])} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100">
              <option value="quote">Quote visit</option>
              <option value="service">Service appointment</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Location or meeting note
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Customer address, district, or video call" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Message to customer
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Explain why you are proposing this change and what the customer should prepare." className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={secondaryActionButton}>
              <MdCancel size={18} aria-hidden="true" />
              Keep current time
            </button>
            <button type="submit" disabled={submitting || !date || !time} className={primaryActionButton}>
              <MdSchedule size={18} aria-hidden="true" />
              {submitting ? 'Sending...' : 'Send change request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CancelAppointmentModal({
  customerName,
  onClose,
  onConfirm,
}: {
  customerName: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('Schedule does not work')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onConfirm([
        `Reason: ${reason}`,
        details.trim() ? `Details: ${details.trim()}` : '',
      ].filter(Boolean).join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this appointment.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">Cancel appointment</p>
            <h2 className="text-2xl font-black text-gray-900" style={dg}>Cancel with {customerName || 'the customer'}?</h2>
            <p className="mt-1 text-sm text-gray-500">This cancels the request and notifies the customer.</p>
          </div>
          <button type="button" onClick={onClose} className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer" aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Why are you cancelling?
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100">
              {['Schedule does not work', 'Customer requested cancellation', 'Scope changed', 'Emergency or availability issue', 'Other'].map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            Details for the customer <span className="font-normal text-gray-400">(optional)</span>
            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} placeholder="Add context or explain whether they can rebook later." className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={secondaryActionButton}>
              <MdCancel size={18} aria-hidden="true" />
              Keep appointment
            </button>
            <button type="submit" disabled={submitting} className={darkActionButton}>
              <MdCancel size={18} aria-hidden="true" />
              {submitting ? 'Cancelling...' : 'Cancel appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [req, setReq] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [busyAction, setBusyAction] = useState<'complete' | null>(null)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const snap = await getDoc(doc(db, 'serviceRequests', id))
        if (!snap.exists()) {
          setReq(null)
          setLoading(false)
          return
        }

        const data = { id: snap.id, ...snap.data() } as ServiceRequest
        if (data.proUid !== user.uid) {
          setForbidden(true)
          setLoading(false)
          return
        }

        setReq(data)
      } catch {
        setReq(null)
      } finally {
        setLoading(false)
      }
    })
  }, [id, router])

  async function refreshRequest() {
    const snap = await getDoc(doc(db, 'serviceRequests', id))
    if (snap.exists()) setReq({ id: snap.id, ...snap.data() } as ServiceRequest)
  }

  async function handleMarkComplete() {
    setBusyAction('complete')
    setActionError('')
    try {
      await markServiceRequestComplete(id)
      await refreshRequest()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark this job complete.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleReschedule(input: AppointmentRequestInput) {
    if (!req) return
    await requestAppointment(id, req.proUid, input, { isChangeRequest: true })
    await refreshRequest()
    setShowReschedule(false)
  }

  async function handleCancel(reason: string) {
    await cancelServiceRequest(id, reason)
    await refreshRequest()
    setShowCancel(false)
  }

  if (loading) {
    return (
      <main className="bg-gray-50 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-28 mb-8" />
          <div className="h-96 bg-white border border-gray-200 rounded-2xl" />
        </div>
      </main>
    )
  }

  if (forbidden || !req || !req.appointmentRequest) {
    return (
      <main className="bg-gray-50 min-h-screen">
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>Appointment not found</p>
          <p className="text-gray-500 mb-6 text-sm">
            This appointment does not exist or you do not have permission to view it.
          </p>
          <Link href="/pro/work" className="inline-block bg-orange-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">
            Back to My Work
          </Link>
        </div>
      </main>
    )
  }

  const appointment = req.appointmentRequest
  const details = formatAnswers(req.answers)
  const isConfirmed = appointment.status === 'confirmed'
  const [lat, lng] = appointmentCoords(req, appointment)
  const approximateLocation = appointment.jobLocation ?? req.jobLocation ?? null
  const locationLabel = appointment.location || (approximateLocation ? approximateLocationLabel(approximateLocation) : districtCopy(req))
  const mapLabel = req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
  const stageIndex = appointmentStage(appointment)
  const isActiveJob = req.status === 'accepted'
  const completionRequested = req.completion?.status === 'pro_marked_complete'
  const isCompleted = req.status === 'completed'
  const requestCanCancel = canCancel(req.status)
  const stages = [
    'Requested',
    'Confirmed',
    'Today',
    'In progress',
    'Follow up',
  ]

  return (
    <main className="bg-gray-50 min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link href="/pro/work" className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex">
          ← My Work
        </Link>

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">
            {isConfirmed ? 'Confirmed appointment' : 'Appointment request'}
          </p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {req.categoryName}
          </h1>
          <p className="text-gray-500 text-base mt-2">
            with {req.customerName || 'Customer'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <section className="lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 mb-6">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">
                  {appointment.kind === 'quote' ? 'Quote visit' : 'Service appointment'}
                </p>
                <p className="text-3xl font-black text-gray-900 leading-none" style={dg}>
                  {formatAppointmentDateTime(appointment.date, appointment.time)}
                </p>
                <p className="text-sm text-slate-600 font-semibold mt-3">{appointment.duration}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Customer</p>
                  <p className="text-sm font-semibold text-gray-900">{req.customerName || 'Customer'}</p>
                  {req.customerEmail && (
                    <a href={`mailto:${req.customerEmail}`} className="text-sm text-orange-500 hover:underline">
                      {req.customerEmail}
                    </a>
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Location</p>
                  <p className="text-sm font-semibold text-gray-900">{locationLabel}</p>
                  <a
                    href={mapsUrl(req, appointment)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-orange-500 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>

              {appointment.notes && (
                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">Appointment note</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              )}
            </div>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Progress</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Appointment stage</h2>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {stages.map((stage, index) => {
                  const active = index <= stageIndex
                  const current = index === stageIndex
                  return (
                    <div
                      key={stage}
                      className={`rounded-xl border p-3 ${
                        active ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${
                        active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <p className={`text-sm font-semibold ${current ? 'text-orange-800' : active ? 'text-gray-900' : 'text-gray-400'}`}>
                        {stage}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Customer location</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>
                {mapLabel}
              </h2>
              <DistrictMap
                lat={lat}
                lng={lng}
                districtLabel={locationLabel}
                height={300}
                radius={approximateRadiusMeters(approximateLocation)}
                popupText={locationLabel}
              />
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-gray-400">
                  {approximateLocation
                    ? 'Map shows the approximate job area captured from the customer permission. Use Google Maps for the exact address if shared.'
                    : 'Map shows the customer district. Use Google Maps for the exact address if shared.'}
                </p>
                <a
                  href={mapsUrl(req, appointment)}
                  target="_blank"
                  rel="noreferrer"
                  className={darkActionButton}
                >
                  <MdMap size={18} aria-hidden="true" />
                  Open Google Maps
                </a>
              </div>
            </section>
          </section>

          <aside className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Appointment actions</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>Manage this job</h2>
              <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                isCompleted
                  ? 'border-green-100 bg-green-50 text-green-700'
                  : completionRequested
                  ? 'border-orange-100 bg-orange-50 text-orange-700'
                  : req.status === 'cancelled'
                  ? 'border-gray-200 bg-gray-100 text-gray-600'
                  : 'border-gray-100 bg-gray-50 text-gray-600'
              }`}>
                {actionStatusCopy(req)}
              </p>
              {actionError && <p className="mb-3 text-sm font-semibold text-red-600">{actionError}</p>}
              <div className="flex flex-col gap-2">
                {isActiveJob && !completionRequested && (
                  <button
                    type="button"
                    onClick={handleMarkComplete}
                    disabled={busyAction === 'complete'}
                    className={primaryActionButton}
                  >
                    <MdCheckCircle size={18} aria-hidden="true" />
                    {busyAction === 'complete' ? 'Marking complete...' : 'Mark job complete'}
                  </button>
                )}
                {isActiveJob && (
                  <button
                    type="button"
                    onClick={() => setShowReschedule(true)}
                    className={secondaryActionButton}
                  >
                    <MdSchedule size={18} aria-hidden="true" />
                    Propose appointment change
                  </button>
                )}
                {requestCanCancel && (
                  <button
                    type="button"
                    onClick={() => setShowCancel(true)}
                    className={dangerActionButton}
                  >
                    <MdCancel size={18} aria-hidden="true" />
                    Cancel appointment
                  </button>
                )}
              </div>
              <Link
                href={`/pro/jobs/${req.id}`}
                className={`mt-4 ${darkActionButton}`}
              >
                <MdWork size={18} aria-hidden="true" />
                Open job details
              </Link>
              <Link
                href={`/pro/messages/${req.id}`}
                className={`mt-2 ${secondaryActionButton}`}
              >
                <MdMessage size={18} aria-hidden="true" />
                Message customer
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Day-of checklist</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Complete smoothly</h2>
              <ul className="flex flex-col gap-2.5 text-sm text-gray-600">
                <li>Confirm parking, entry codes, pets, and elevator access.</li>
                <li>Bring any materials included in the quote.</li>
                <li>Take before photos if useful for the job record.</li>
                <li>Explain extra costs before doing additional work.</li>
              </ul>
            </div>

            {details.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Project brief</p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Customer answers</h2>
                <div className="divide-y divide-gray-100">
                  {details.slice(0, 5).map(detail => (
                    <div key={detail.key} className="py-2.5 flex justify-between gap-4 text-sm">
                      <span className="text-gray-500">{detail.key}</span>
                      <span className="font-semibold text-gray-900 text-right">{detail.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
      {showReschedule && (
        <RescheduleModal
          req={req}
          appointment={appointment}
          onClose={() => setShowReschedule(false)}
          onSubmit={handleReschedule}
        />
      )}
      {showCancel && (
        <CancelAppointmentModal
          customerName={req.customerName || 'the customer'}
          onClose={() => setShowCancel(false)}
          onConfirm={handleCancel}
        />
      )}
    </main>
  )
}

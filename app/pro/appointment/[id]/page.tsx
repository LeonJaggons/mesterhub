'use client'

import { use, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { MdCancel, MdCheckCircle, MdMap, MdMessage, MdSchedule, MdWork } from 'react-icons/md'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { requestAppointment, type AppointmentRequestInput } from '@/firebase/conversations'
import { useTranslations } from '@/lib/i18n/client'
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
import type { InquiryTimestamp } from '@/lib/inquiryAccess'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const actionButtonBase = 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold leading-5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'
const primaryActionButton = `${actionButtonBase} border border-orange-500 bg-orange-500 text-white hover:bg-orange-600 hover:border-orange-600`
const darkActionButton = `${actionButtonBase} border border-slate-800 bg-slate-800 text-white hover:bg-slate-900 hover:border-slate-900`
const secondaryActionButton = `${actionButtonBase} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`
const dangerActionButton = `${actionButtonBase} border border-gray-300 bg-white text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700`
type Translator = ReturnType<typeof useTranslations>

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
  requestedAt: InquiryTimestamp
  confirmedAt?: InquiryTimestamp
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
  createdAt: InquiryTimestamp
  obfuscated?: boolean
}

function formatAppointmentDateTime(t: Translator, date: string, time: string): string {
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} ${t('proAppointment.common.at')} ${time}`
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

function districtCopy(t: Translator, req: ServiceRequest): string {
  return req.customerDistrict ? districtLabel(req.customerDistrict) : t('proWork.location.notShared')
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

function mapsUrl(t: Translator, req: ServiceRequest, appointment: AppointmentRequest): string {
  const location = appointment.jobLocation ?? req.jobLocation
  if (!appointment.location && location) {
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`
  }
  const query = appointment.location || districtCopy(t, req) || 'Budapest'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function canCancel(status: ServiceRequestStatus): boolean {
  return status === 'pending' || status === 'quoted' || status === 'accepted'
}

function actionStatusCopy(t: Translator, req: ServiceRequest): string {
  if (req.status === 'completed') return t('proAppointment.actions.completed')
  if (req.status === 'cancelled') return req.cancelReason ? t('proAppointment.actions.cancelledWithReason', { reason: req.cancelReason }) : t('proAppointment.actions.cancelled')
  if (req.completion?.status === 'pro_marked_complete') return t('proAppointment.actions.waitingCompletion')
  if (req.appointmentChangeRequest?.status === 'proposed') return t('proAppointment.actions.changeSent')
  return t('proAppointment.actions.default')
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
  const t = useTranslations()
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
      setError(t('proAppointment.reschedule.dateTimeError'))
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
      setError(err instanceof Error ? err.message : t('proAppointment.reschedule.sendError'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={onClose}>
      <div className="w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">{t('proAppointment.reschedule.kicker')}</p>
            <h2 className="text-2xl font-black text-gray-900" style={dg}>{t('proAppointment.reschedule.title')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('proAppointment.reschedule.body')}</p>
          </div>
          <button type="button" onClick={onClose} className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer" aria-label={t('proAppointment.common.close')}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proAppointment.reschedule.date')}
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proAppointment.reschedule.time')}
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              {t('proAppointment.reschedule.duration')}
              <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100">
                {[
                  { value: '30 minutes', label: t('messages.appointmentModal.durations.30') },
                  { value: '60 minutes', label: t('messages.appointmentModal.durations.60') },
                  { value: '90 minutes', label: t('messages.appointmentModal.durations.90') },
                  { value: '2 hours', label: t('messages.appointmentModal.durations.2h') },
                  { value: 'Half day', label: t('messages.appointmentModal.durations.halfDay') },
                  { value: 'Full day', label: t('messages.appointmentModal.durations.fullDay') },
                ].map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proAppointment.reschedule.type')}
            <select value={kind} onChange={e => setKind(e.target.value as AppointmentRequestInput['kind'])} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100">
              <option value="quote">{t('proAppointment.kind.quote')}</option>
              <option value="service">{t('proAppointment.kind.service')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proAppointment.reschedule.location')}
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('proAppointment.reschedule.locationPlaceholder')} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proAppointment.reschedule.message')}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder={t('proAppointment.reschedule.messagePlaceholder')} className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={secondaryActionButton}>
              <MdCancel size={18} aria-hidden="true" />
              {t('proAppointment.reschedule.keep')}
            </button>
            <button type="submit" disabled={submitting || !date || !time} className={primaryActionButton}>
              <MdSchedule size={18} aria-hidden="true" />
              {submitting ? t('proAppointment.reschedule.sending') : t('proAppointment.reschedule.submit')}
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
  const t = useTranslations()
  const cancelReasons = [
    { value: 'Schedule does not work', label: t('proAppointment.cancelModal.reasons.schedule') },
    { value: 'Customer requested cancellation', label: t('proAppointment.cancelModal.reasons.customer') },
    { value: 'Scope changed', label: t('proAppointment.cancelModal.reasons.scope') },
    { value: 'Emergency or availability issue', label: t('proAppointment.cancelModal.reasons.emergency') },
    { value: 'Other', label: t('proAppointment.cancelModal.reasons.other') },
  ]
  const [reason, setReason] = useState(cancelReasons[0].value)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onConfirm([
        `${t('proAppointment.cancelModal.reasonPrefix')}: ${reason}`,
        details.trim() ? `${t('proAppointment.cancelModal.detailsPrefix')}: ${details.trim()}` : '',
      ].filter(Boolean).join('\n'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proAppointment.cancelModal.error'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">{t('proAppointment.cancelModal.kicker')}</p>
            <h2 className="text-2xl font-black text-gray-900" style={dg}>{t('proAppointment.cancelModal.title', { name: customerName || t('proAppointment.cancelModal.customerFallback') })}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('proAppointment.cancelModal.body')}</p>
          </div>
          <button type="button" onClick={onClose} className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer" aria-label={t('proAppointment.common.close')}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proAppointment.cancelModal.why')}
            <select value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100">
              {cancelReasons.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
            {t('proAppointment.cancelModal.details')} <span className="font-normal text-gray-400">{t('proAppointment.cancelModal.optional')}</span>
            <textarea value={details} onChange={e => setDetails(e.target.value)} rows={4} placeholder={t('proAppointment.cancelModal.detailsPlaceholder')} className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100" />
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className={secondaryActionButton}>
              <MdCancel size={18} aria-hidden="true" />
              {t('proAppointment.cancelModal.keep')}
            </button>
            <button type="submit" disabled={submitting} className={darkActionButton}>
              <MdCancel size={18} aria-hidden="true" />
              {submitting ? t('proAppointment.cancelModal.cancelling') : t('proAppointment.cancelModal.submit')}
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
  const t = useTranslations()
  const [req, setReq] = useState<ServiceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden] = useState(false)
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
        const res = await authenticatedFetch(`/api/pro/service-requests/${id}`)
        const payload = await res.json()
        const data = payload.request as ServiceRequest | undefined
        if (!data || data.obfuscated === true) {
          setReq(null)
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
    const res = await authenticatedFetch(`/api/pro/service-requests/${id}`)
    const payload = await res.json()
    if (payload.request && payload.request.obfuscated !== true) setReq(payload.request as ServiceRequest)
  }

  async function handleMarkComplete() {
    setBusyAction('complete')
    setActionError('')
    try {
      await markServiceRequestComplete(id)
      await refreshRequest()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('proAppointment.actions.markError'))
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
          <p className="text-xl font-bold text-gray-900 mb-2" style={dg}>{t('proAppointment.notFound.title')}</p>
          <p className="text-gray-500 mb-6 text-sm">
            {t('proAppointment.notFound.body')}
          </p>
          <Link href="/pro/work" className="inline-block bg-orange-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-orange-600">
            {t('proAppointment.notFound.back')}
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
  const locationLabel = appointment.location || (approximateLocation ? approximateLocationLabel(approximateLocation) : districtCopy(t, req))
  const mapLabel = req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
  const stageIndex = appointmentStage(appointment)
  const isActiveJob = req.status === 'accepted'
  const completionRequested = req.completion?.status === 'pro_marked_complete'
  const isCompleted = req.status === 'completed'
  const requestCanCancel = canCancel(req.status)
  const stages = [
    t('proAppointment.progress.requested'),
    t('proAppointment.progress.confirmed'),
    t('proAppointment.progress.today'),
    t('proAppointment.progress.inProgress'),
    t('proAppointment.progress.followUp'),
  ]

  return (
    <main className="bg-gray-50 min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link href="/pro/work" className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex">
          {t('proAppointment.header.back')}
        </Link>

        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">
            {isConfirmed ? t('proAppointment.header.confirmed') : t('proAppointment.header.request')}
          </p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {req.categoryName}
          </h1>
          <p className="text-gray-500 text-base mt-2">
            {t('proAppointment.header.withCustomer', { name: req.customerName || t('proAppointment.common.customer') })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <section className="lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 mb-6">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">
                  {appointment.kind === 'quote' ? t('proAppointment.kind.quote') : t('proAppointment.kind.service')}
                </p>
                <p className="text-3xl font-black text-gray-900 leading-none" style={dg}>
                  {formatAppointmentDateTime(t, appointment.date, appointment.time)}
                </p>
                <p className="text-sm text-slate-600 font-semibold mt-3">{appointment.duration}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">{t('proAppointment.details.customer')}</p>
                  <p className="text-sm font-semibold text-gray-900">{req.customerName || t('proAppointment.common.customer')}</p>
                  {req.customerEmail && (
                    <a href={`mailto:${req.customerEmail}`} className="text-sm text-orange-500 hover:underline">
                      {req.customerEmail}
                    </a>
                  )}
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">{t('proAppointment.details.location')}</p>
                  <p className="text-sm font-semibold text-gray-900">{locationLabel}</p>
                  <a
                    href={mapsUrl(t, req, appointment)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-orange-500 hover:underline"
                  >
                    {t('proAppointment.details.openMaps')}
                  </a>
                </div>
              </div>

              {appointment.notes && (
                <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-xs text-gray-400 mb-1">{t('proAppointment.details.note')}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              )}
            </div>

            <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proAppointment.progress.kicker')}</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proAppointment.progress.title')}</h2>
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
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proAppointment.map.kicker')}</p>
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
                    ? t('proAppointment.map.approximate')
                    : t('proAppointment.map.district')}
                </p>
                <a
                  href={mapsUrl(t, req, appointment)}
                  target="_blank"
                  rel="noreferrer"
                  className={darkActionButton}
                >
                  <MdMap size={18} aria-hidden="true" />
                  {t('proAppointment.details.openGoogleMaps')}
                </a>
              </div>
            </section>
          </section>

          <aside className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proAppointment.actions.kicker')}</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-3" style={dg}>{t('proAppointment.actions.title')}</h2>
              <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
                isCompleted
                  ? 'border-green-100 bg-green-50 text-green-700'
                  : completionRequested
                  ? 'border-orange-100 bg-orange-50 text-orange-700'
                  : req.status === 'cancelled'
                  ? 'border-gray-200 bg-gray-100 text-gray-600'
                  : 'border-gray-100 bg-gray-50 text-gray-600'
              }`}>
                {actionStatusCopy(t, req)}
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
                    {busyAction === 'complete' ? t('proAppointment.actions.marking') : t('proAppointment.actions.markComplete')}
                  </button>
                )}
                {isActiveJob && (
                  <button
                    type="button"
                    onClick={() => setShowReschedule(true)}
                    className={secondaryActionButton}
                  >
                    <MdSchedule size={18} aria-hidden="true" />
                    {t('proAppointment.actions.proposeChange')}
                  </button>
                )}
                {requestCanCancel && (
                  <button
                    type="button"
                    onClick={() => setShowCancel(true)}
                    className={dangerActionButton}
                  >
                    <MdCancel size={18} aria-hidden="true" />
                    {t('proAppointment.actions.cancel')}
                  </button>
                )}
              </div>
              <Link
                href={`/pro/jobs/${req.id}`}
                className={`mt-4 ${darkActionButton}`}
              >
                <MdWork size={18} aria-hidden="true" />
                {t('proAppointment.actions.openJob')}
              </Link>
              <Link
                href={`/pro/messages/${req.id}`}
                className={`mt-2 ${secondaryActionButton}`}
              >
                <MdMessage size={18} aria-hidden="true" />
                {t('proAppointment.actions.message')}
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proAppointment.checklist.kicker')}</p>
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proAppointment.checklist.title')}</h2>
              <ul className="flex flex-col gap-2.5 text-sm text-gray-600">
                <li>{t('proAppointment.checklist.parking')}</li>
                <li>{t('proAppointment.checklist.materials')}</li>
                <li>{t('proAppointment.checklist.photos')}</li>
                <li>{t('proAppointment.checklist.costs')}</li>
              </ul>
            </div>

            {details.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proAppointment.brief.kicker')}</p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proAppointment.brief.title')}</h2>
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
          customerName={req.customerName || t('proAppointment.cancelModal.customerFallback')}
          onClose={() => setShowCancel(false)}
          onConfirm={handleCancel}
        />
      )}
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/firebase/apiClient'
import type { JobLocation } from '@/firebase/serviceRequests'
import type { InquiryTimestamp } from '@/lib/inquiryAccess'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type Translator = ReturnType<typeof useTranslations>

type RequestStatus = 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'

type AppointmentRequest = {
  kind: 'quote' | 'service'
  date: string
  time: string
  duration: string
  location: string
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
  acceptance?: { address?: string }
  jobLocation?: JobLocation
  status: RequestStatus
  appointmentRequest?: AppointmentRequest
  createdAt: InquiryTimestamp
  obfuscated?: boolean
}

function appointmentDate(req: ServiceRequest): Date | null {
  const appointment = req.appointmentRequest
  if (!appointment?.date || !appointment.time) return null
  const parsed = new Date(`${appointment.date}T${appointment.time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatAppointmentDateTime(t: Translator, locale: string, date: string, time: string): string {
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return t('proWork.appointments.dateAtTime', { date, time })
  return parsed.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function districtCopy(t: Translator, req: ServiceRequest): string {
  if (req.jobLocation) {
    const accuracy = req.jobLocation.accuracy
    if (!accuracy) return t('proWork.location.approximate')
    const meters = Math.max(Math.ceil(accuracy), 500)
    if (meters >= 1000) {
      return t('proWork.location.approximateKm', { distance: (meters / 1000).toFixed(1) })
    }
    return t('proWork.location.approximateM', { distance: meters })
  }
  return req.customerDistrict
    ? t('proWork.location.district', { district: req.customerDistrict })
    : t('proWork.location.notShared')
}

export default function WorkPage() {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    authenticatedFetch('/api/pro/service-requests')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const requests = Array.isArray(data.requests) ? data.requests as ServiceRequest[] : []
        setRequests(
          requests
            .filter(request => !request.obfuscated)
            .sort((a, b) => {
              const aTime = appointmentDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER
              const bTime = appointmentDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER
              return aTime - bTime
            })
        )
      })
      .catch(() => {
        if (!active) return
        setRequests([])
        router.push('/login')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [router])

  const confirmedAppointments = requests.filter(r =>
    r.status === 'accepted' && r.appointmentRequest?.status === 'confirmed'
  )
  const acceptedWithoutAppointment = requests.filter(
    r => r.status === 'accepted' && r.appointmentRequest?.status !== 'confirmed'
  )

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">{t('proWork.header.kicker')}</p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            {t('proWork.header.title')}
          </h1>
          <p className="text-gray-500 text-base mt-2">
            {t('proWork.header.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white border border-gray-200 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <section className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">
                  {t('proWork.appointments.kicker')}
                </p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>
                  {t('proWork.appointments.title')}
                </h2>
                {confirmedAppointments.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {confirmedAppointments.map(req => {
                      const appointment = req.appointmentRequest!
                      return (
                        <Link
                          key={req.id}
                          href={`/pro/appointment/${req.id}`}
                          className="block rounded-md bg-slate-50 border border-slate-100 p-4 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                              <p className="text-base font-bold text-gray-900">{translateCategory(t, req.categoryName)}</p>
                              <p className="text-sm text-slate-700 font-semibold mt-1">
                                {formatAppointmentDateTime(t, locale, appointment.date, appointment.time)}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {req.customerName || t('proWork.customerFallback')} · {appointment.duration}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {req.acceptance?.address || districtCopy(t, req)}
                              </p>
                            </div>
                            <span className="w-fit text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-full px-2.5 py-1">
                              {t('proWork.appointments.confirmed')}
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {t('proWork.appointments.empty')}
                  </p>
                )}
              </div>
            </section>

            <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">{t('proWork.summary.kicker')}</p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proWork.summary.title')}</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-slate-50 border border-slate-100 p-3">
                    <p className="text-2xl font-black text-slate-800" style={dg}>{confirmedAppointments.length}</p>
                    <p className="text-xs text-slate-500">{t('proWork.summary.confirmed')}</p>
                  </div>
                  <div className="rounded-md bg-sky-50 border border-sky-100 p-3">
                    <p className="text-2xl font-black text-sky-700" style={dg}>{acceptedWithoutAppointment.length}</p>
                    <p className="text-xs text-sky-700">{t('proWork.summary.needScheduling')}</p>
                  </div>
                </div>
              </div>

              {acceptedWithoutAppointment.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs font-bold tracking-widest uppercase text-sky-500 mb-2">{t('proWork.schedule.kicker')}</p>
                  <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>{t('proWork.schedule.title')}</h2>
                  <div className="flex flex-col gap-2">
                    {acceptedWithoutAppointment.slice(0, 3).map(req => (
                      <Link
                        key={req.id}
                        href={`/pro/jobs/${req.id}`}
                        className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2 hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-sm font-semibold text-gray-900">{translateCategory(t, req.categoryName)}</p>
                        <p className="text-xs text-gray-400">{req.customerName || t('proWork.customerFallback')} · {districtCopy(t, req)}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

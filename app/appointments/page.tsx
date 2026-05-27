'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from '../account/account.module.css'
import {
  approximateRadiusMeters,
  dg,
  districtLabel,
  fetchProSummary,
  type AppointmentRequest,
  type ProSummary,
  type ServiceRequest,
} from '../requests/shared'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type Translator = ReturnType<typeof useTranslations>

type ConfirmedAppointmentRequest = ServiceRequest & {
  appointmentRequest: AppointmentRequest & { status: 'confirmed' }
  pro: ProSummary | null
}

type ServiceStatusFilter = 'all' | 'accepted' | 'completed' | 'cancelled'

const SERVICE_STATUS_FILTERS: Array<{ id: ServiceStatusFilter; labelKey: string }> = [
  { id: 'all', labelKey: 'all' },
  { id: 'accepted', labelKey: 'active' },
  { id: 'completed', labelKey: 'completed' },
  { id: 'cancelled', labelKey: 'cancelled' },
]

function appointmentStart(appointment: AppointmentRequest): Date | null {
  const parsed = new Date(`${appointment.date}T${appointment.time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatAppointmentDateTime(date: string, time: string, locale: string, t: Translator): string {
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} ${t('appointments.common.at')} ${time}`
  return parsed.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function approximateLocationLabel(t: Translator, location?: ServiceRequest['jobLocation'] | null): string | null {
  if (!location) return null
  if (!location.accuracy) return t('appointments.location.approximate')
  const meters = approximateRadiusMeters(location)
  if (meters >= 1000) return t('appointments.location.withinKm', { distance: (meters / 1000).toFixed(1) })
  return t('appointments.location.withinMeters', { distance: meters })
}

function locationLabel(t: Translator, req: ServiceRequest, appointment: AppointmentRequest): string {
  if (req.acceptance?.address) return req.acceptance.address
  const appointmentLocation = approximateLocationLabel(t, appointment.jobLocation)
  if (appointmentLocation) return appointmentLocation
  const requestLocation = approximateLocationLabel(t, req.jobLocation)
  if (requestLocation) return requestLocation
  return req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
}

function AppointmentCard({ req }: { req: ConfirmedAppointmentRequest }) {
  const t = useTranslations()
  const locale = useLocale()
  const appointment = req.appointmentRequest
  const proName = req.pro?.fullName ?? req.proName
  const isCancelled = req.status === 'cancelled'

  return (
    <Link href={`/requests/${req.id}`} className="block group">
      <article className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all group-hover:shadow-md ${
        isCancelled ? 'border-gray-300 opacity-80' : 'border-gray-200 group-hover:border-slate-300'
      }`}>
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-1">
                {appointment.kind === 'quote' ? t('appointments.card.quoteVisit') : t('appointments.card.serviceAppointment')}
              </p>
              <h2 className="font-black text-gray-900 text-2xl leading-none" style={dg}>
                {translateCategory(t, req.categoryName)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{t('appointments.card.withPro', { name: proName })}</p>
            </div>
            <span className={`w-fit text-xs font-bold border rounded-full px-2.5 py-1 ${
              isCancelled
                ? 'text-gray-600 bg-gray-100 border-gray-200'
                : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              {isCancelled ? t('appointments.status.cancelled') : t('appointments.status.confirmed')}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-3">
            <p className="text-lg font-black text-gray-900" style={dg}>
              {formatAppointmentDateTime(appointment.date, appointment.time, locale, t)}
            </p>
            <p className="text-sm text-gray-500 mt-1">{appointment.duration}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-1">{t('appointments.card.location')}</p>
              <p className="font-semibold text-gray-900">{locationLabel(t, req, appointment)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-1">{t('appointments.card.price')}</p>
              <p className="font-semibold text-gray-900">{req.quote?.price ?? t('appointments.card.quoteAccepted')}</p>
            </div>
          </div>

          {isCancelled && (
            <p className="text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 mt-3">
              {req.cancelReason
                ? t('appointments.card.cancelledWithReason', { reason: req.cancelReason })
                : t('appointments.card.cancelled')}
            </p>
          )}

          {appointment.notes && (
            <p className="text-sm text-gray-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 mt-3 whitespace-pre-wrap">
              {appointment.notes}
            </p>
          )}
        </div>

        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs font-semibold text-slate-700 group-hover:bg-slate-50 transition-colors">
          {t('appointments.card.viewDetails')}
        </div>
      </article>
    </Link>
  )
}

export default function AppointmentsPage() {
  const t = useTranslations()
  const router = useRouter()
  const [appointments, setAppointments] = useState<ConfirmedAppointmentRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/appointments')
        return
      }

      try {
        const response = await authenticatedFetch('/api/service-requests')
        const data = (await response.json()) as { requests?: ServiceRequest[] }
        const confirmed = (data.requests ?? [])
          .filter((req): req is ServiceRequest & { appointmentRequest: AppointmentRequest & { status: 'confirmed' } } =>
            req.appointmentRequest?.status === 'confirmed'
          )
          .sort((a, b) => {
            const aTime = appointmentStart(a.appointmentRequest)?.getTime() ?? Number.MAX_SAFE_INTEGER
            const bTime = appointmentStart(b.appointmentRequest)?.getTime() ?? Number.MAX_SAFE_INTEGER
            return aTime - bTime
          })

        const uids = [...new Set(confirmed.map(req => req.proUid))]
        const pros = await Promise.all(uids.map(uid => fetchProSummary(uid)))
        const proMap = new Map(pros.filter(Boolean).map(pro => [pro!.uid, pro!]))

        setAppointments(confirmed.map(req => ({
          ...req,
          pro: proMap.get(req.proUid) ?? null,
        })))
      } catch {
        setAppointments([])
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  const defaultAppointments = appointments.filter(req => req.status === 'accepted')
  const filteredAppointments = statusFilter === 'all'
    ? defaultAppointments
    : appointments.filter(req => req.status === statusFilter)

  function countForStatus(status: ServiceStatusFilter): number {
    if (status === 'all') return defaultAppointments.length
    return appointments.filter(req => req.status === status).length
  }

  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className={styles.title}>{t('appointments.header.title')}</h1>
        <p className={styles.subtitle}>{t('appointments.header.subtitle')}</p>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-52 bg-white rounded-2xl border border-gray-200" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            <p className={styles.emptyTitle}>{t('appointments.empty.title')}</p>
            <p>{t('appointments.empty.body')}</p>
            <Link href="/requests" className={styles.linkBtn}>
              {t('appointments.empty.cta')}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-5" aria-label={t('appointments.filters.aria')}>
              {SERVICE_STATUS_FILTERS.map(filter => {
                const active = statusFilter === filter.id
                const count = countForStatus(filter.id)
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold cursor-pointer transition-colors ${
                      active
                        ? 'bg-slate-800 border-slate-800 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-pressed={active}
                  >
                    {t(`appointments.filters.${filter.labelKey}`)} <span className={active ? 'text-slate-200' : 'text-gray-400'}>{count}</span>
                  </button>
                )
              })}
            </div>

            {filteredAppointments.length === 0 ? (
              <div className={`${styles.card} ${styles.empty}`}>
                <p className={styles.emptyTitle}>
                  {t('appointments.emptyStatus.title', { status: t(`appointments.filters.${SERVICE_STATUS_FILTERS.find(f => f.id === statusFilter)?.labelKey ?? 'all'}`).toLowerCase() })}
                </p>
                <p>{t('appointments.emptyStatus.body')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filteredAppointments.map(req => (
                  <AppointmentCard key={req.id} req={req} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

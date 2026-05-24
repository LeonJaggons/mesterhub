'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase/index'
import { onAuthChange } from '@/firebase/auth'
import styles from '../account/account.module.css'
import {
  approximateLocationLabel,
  dg,
  districtLabel,
  fetchProSummary,
  type AppointmentRequest,
  type ProSummary,
  type ServiceRequest,
} from '../requests/shared'

type ConfirmedAppointmentRequest = ServiceRequest & {
  appointmentRequest: AppointmentRequest & { status: 'confirmed' }
  pro: ProSummary | null
}

type ServiceStatusFilter = 'all' | 'accepted' | 'completed' | 'cancelled'

const SERVICE_STATUS_FILTERS: Array<{ id: ServiceStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'accepted', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

function appointmentStart(appointment: AppointmentRequest): Date | null {
  const parsed = new Date(`${appointment.date}T${appointment.time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatAppointmentDateTime(date: string, time: string): string {
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

function locationLabel(req: ServiceRequest, appointment: AppointmentRequest): string {
  if (appointment.location) return appointment.location
  if (appointment.jobLocation) return approximateLocationLabel(appointment.jobLocation)
  if (req.jobLocation) return approximateLocationLabel(req.jobLocation)
  return req.customerDistrict ? districtLabel(req.customerDistrict) : 'Budapest'
}

function AppointmentCard({ req }: { req: ConfirmedAppointmentRequest }) {
  const appointment = req.appointmentRequest
  const proName = req.pro?.fullName ?? req.proName
  const isCancelled = req.status === 'cancelled'

  return (
    <Link href={`/requests/${req.id}`} className="block group">
      <article className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all group-hover:shadow-md ${
        isCancelled ? 'border-gray-300 opacity-80' : 'border-gray-200 group-hover:border-orange-200'
      }`}>
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">
                {appointment.kind === 'quote' ? 'Quote visit' : 'Service appointment'}
              </p>
              <h2 className="font-black text-gray-900 text-2xl leading-none" style={dg}>
                {req.categoryName}
              </h2>
              <p className="text-sm text-gray-500 mt-1">with {proName}</p>
            </div>
            <span className={`w-fit text-xs font-bold border rounded-full px-2.5 py-1 ${
              isCancelled
                ? 'text-gray-600 bg-gray-100 border-gray-200'
                : 'text-slate-700 bg-slate-50 border-slate-200'
            }`}>
              {isCancelled ? 'Cancelled' : 'Confirmed'}
            </span>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-3">
            <p className="text-lg font-black text-gray-900" style={dg}>
              {formatAppointmentDateTime(appointment.date, appointment.time)}
            </p>
            <p className="text-sm text-gray-500 mt-1">{appointment.duration}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-1">Location</p>
              <p className="font-semibold text-gray-900">{locationLabel(req, appointment)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-xs text-gray-400 mb-1">Price</p>
              <p className="font-semibold text-gray-900">{req.quote?.price ?? 'Quote accepted'}</p>
            </div>
          </div>

          {isCancelled && (
            <p className="text-sm text-gray-600 bg-gray-100 border border-gray-200 rounded-xl px-3 py-2 mt-3">
              This request was cancelled{req.cancelReason ? `: ${req.cancelReason}` : '.'}
            </p>
          )}

          {appointment.notes && (
            <p className="text-sm text-gray-600 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 mt-3 whitespace-pre-wrap">
              {appointment.notes}
            </p>
          )}
        </div>

        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs font-semibold text-orange-600 group-hover:bg-orange-50 transition-colors">
          View request details →
        </div>
      </article>
    </Link>
  )
}

export default function AppointmentsPage() {
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
        const snap = await getDocs(
          query(collection(db, 'serviceRequests'), where('customerUid', '==', user.uid))
        )
        const confirmed = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ServiceRequest))
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

  const activeAppointments = appointments.filter(req => req.status !== 'cancelled')
  const filteredAppointments = statusFilter === 'all'
    ? activeAppointments
    : appointments.filter(req => req.status === statusFilter)

  function countForStatus(status: ServiceStatusFilter): number {
    if (status === 'all') return activeAppointments.length
    return appointments.filter(req => req.status === status).length
  }

  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className={styles.title}>My appointments</h1>
        <p className={styles.subtitle}>Confirmed appointments with pros you&apos;ve hired.</p>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-52 bg-white rounded-2xl border border-gray-200" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            <p className={styles.emptyTitle}>No confirmed appointments</p>
            <p>Appointments appear here after you confirm a pro&apos;s proposed time.</p>
            <Link href="/requests" className={styles.linkBtn}>
              View my requests
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-5" aria-label="Filter appointments by service status">
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
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-pressed={active}
                  >
                    {filter.label} <span className={active ? 'text-orange-100' : 'text-gray-400'}>{count}</span>
                  </button>
                )
              })}
            </div>

            {filteredAppointments.length === 0 ? (
              <div className={`${styles.card} ${styles.empty}`}>
                <p className={styles.emptyTitle}>No {SERVICE_STATUS_FILTERS.find(f => f.id === statusFilter)?.label.toLowerCase()} appointments</p>
                <p>Choose another service status to see different appointments.</p>
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

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/firebase/apiClient'
import { approximateLocationLabel } from '@/app/requests/shared'
import type { JobLocation } from '@/firebase/serviceRequests'
import type { InquiryTimestamp } from '@/lib/inquiryAccess'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

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

function districtCopy(req: ServiceRequest): string {
  if (req.jobLocation) return approximateLocationLabel(req.jobLocation)
  return req.customerDistrict ? `District ${req.customerDistrict}` : 'District not shared'
}

export default function WorkPage() {
  const router = useRouter()
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
          <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-3">Pro dashboard</p>
          <h1
            className="text-5xl font-black text-gray-900 leading-[1.05]"
            style={{ ...dg, letterSpacing: '-0.02em' }}
          >
            My Work
          </h1>
          <p className="text-gray-500 text-base mt-2">
            Confirmed appointments and accepted jobs ready to schedule.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white border border-gray-200 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <section className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">
                  Confirmed appointments
                </p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>
                  Upcoming work
                </h2>
                {confirmedAppointments.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {confirmedAppointments.map(req => {
                      const appointment = req.appointmentRequest!
                      return (
                        <Link
                          key={req.id}
                          href={`/pro/appointment/${req.id}`}
                          className="block rounded-xl bg-slate-50 border border-slate-100 p-4 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                              <p className="text-base font-bold text-gray-900">{req.categoryName}</p>
                              <p className="text-sm text-slate-700 font-semibold mt-1">
                                {formatAppointmentDateTime(appointment.date, appointment.time)}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                {req.customerName || 'Customer'} · {appointment.duration}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {appointment.location || districtCopy(req)}
                              </p>
                            </div>
                            <span className="w-fit text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-full px-2.5 py-1">
                              Confirmed
                            </span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Confirmed customer appointments will appear here.
                  </p>
                )}
              </div>
            </section>

            <aside className="lg:sticky lg:top-6 flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-2">Work summary</p>
                <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Today&apos;s view</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <p className="text-2xl font-black text-slate-800" style={dg}>{confirmedAppointments.length}</p>
                    <p className="text-xs text-slate-500">Confirmed</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 border border-orange-100 p-3">
                    <p className="text-2xl font-black text-orange-700" style={dg}>{acceptedWithoutAppointment.length}</p>
                    <p className="text-xs text-orange-700">Need scheduling</p>
                  </div>
                </div>
              </div>

              {acceptedWithoutAppointment.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Needs attention</p>
                  <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Schedule next</h2>
                  <div className="flex flex-col gap-2">
                    {acceptedWithoutAppointment.slice(0, 3).map(req => (
                      <Link
                        key={req.id}
                        href={`/pro/jobs/${req.id}`}
                        className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 hover:bg-gray-100 transition-colors"
                      >
                        <p className="text-sm font-semibold text-gray-900">{req.categoryName}</p>
                        <p className="text-xs text-gray-400">{req.customerName || 'Customer'} · {districtCopy(req)}</p>
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

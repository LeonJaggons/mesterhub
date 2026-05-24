'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { MdLocationOn } from 'react-icons/md'
import { db } from '@/firebase/index'
import { onAuthChange } from '@/firebase/auth'
import styles from '../account/account.module.css'
import {
  dg,
  districtLabel,
  fetchProSummary,
  STATUS_COLORS,
  requestStatusLabel,
  timeAgo,
  type ProSummary,
  type ServiceRequest,
} from './shared'
import { ProListSnippet } from './components/ProCard'

type EnrichedRequest = ServiceRequest & { pro: ProSummary | null }
type RequestStatusFilter = 'all' | ServiceRequest['status']

const REQUEST_STATUS_FILTERS: Array<{ id: RequestStatusFilter; label: string }> = [
  { id: 'all', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'completed', label: 'Completed' },
  { id: 'declined', label: 'Declined' },
  { id: 'cancelled', label: 'Cancelled' },
]

function nextAction(req: EnrichedRequest): { label: string; body: string; needsAction: boolean } {
  if (req.status === 'quoted') {
    return {
      label: 'Action needed',
      body: 'Review the quote and accept or decline it.',
      needsAction: true,
    }
  }
  if (req.status === 'accepted' && req.appointmentChangeRequest) {
    return {
      label: 'Action needed',
      body: 'Review the proposed appointment change.',
      needsAction: true,
    }
  }
  if (req.status === 'accepted' && req.appointmentRequest?.status === 'proposed') {
    return {
      label: 'Action needed',
      body: 'Confirm the appointment time proposed by the pro.',
      needsAction: true,
    }
  }
  if (req.status === 'accepted' && req.completion?.status === 'pro_marked_complete') {
    return {
      label: 'Action needed',
      body: 'Confirm the job is complete if the work is finished.',
      needsAction: true,
    }
  }
  if (req.status === 'pending') {
    return {
      label: 'Next step',
      body: `Waiting for ${req.pro?.fullName ?? req.proName} to send a quote.`,
      needsAction: false,
    }
  }
  if (req.status === 'accepted') {
    return {
      label: 'Action needed',
      body: req.appointmentRequest?.status === 'confirmed'
        ? 'Appointment confirmed. Message the pro if anything changes.'
        : 'Coordinate details with the pro and wait for an appointment proposal.',
      needsAction: req.appointmentRequest?.status !== 'confirmed',
    }
  }
  if (req.status === 'completed') {
    return {
      label: 'Closed',
      body: 'This job is complete.',
      needsAction: false,
    }
  }
  if (req.status === 'declined') {
    return {
      label: 'Closed',
      body: requestStatusLabel(req.status, req.declinedBy),
      needsAction: false,
    }
  }
  return {
    label: 'Closed',
    body: req.cancelReason ? `Cancelled: ${req.cancelReason}` : 'This request was cancelled.',
    needsAction: false,
  }
}

function RequestCard({ req }: { req: EnrichedRequest }) {
  const district = req.customerDistrict ? districtLabel(req.customerDistrict) : null
  const action = nextAction(req)
  const shouldOpenConversation = req.status === 'accepted' && req.appointmentRequest?.status !== 'confirmed'

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-orange-200">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          {req.pro ? (
            <ProListSnippet pro={req.pro} />
          ) : (
            <div>
              <p className="font-bold text-gray-900" style={dg}>{req.proName || 'Pro'}</p>
              <p className="text-xs text-gray-500">{req.categoryName}</p>
            </div>
          )}
          <span
            className={`text-xs font-semibold border rounded-full px-2.5 py-1 shrink-0 ${STATUS_COLORS[req.status]}`}
          >
            {requestStatusLabel(req.status, req.declinedBy)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-orange-50 text-orange-700 border border-orange-100 text-xs font-semibold rounded-full px-2.5 py-1">
            {req.categoryName}
          </span>
          {district && (
            <span className="inline-flex items-center gap-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full px-2.5 py-1">
              <MdLocationOn size={13} />
              {district}
            </span>
          )}
          <span className="text-xs text-gray-400 rounded-full px-2 py-1">{timeAgo(req.createdAt)}</span>
        </div>

        {req.quote && (req.status === 'quoted' || req.status === 'accepted') && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <p className="text-xs text-slate-800 font-semibold uppercase tracking-wide mb-0.5">Quote</p>
            <p className="text-sm font-bold text-gray-900">
              {req.quote.price}
              {req.quote.timeline && (
                <span className="font-normal text-gray-600"> · {req.quote.timeline}</span>
              )}
            </p>
          </div>
        )}

        {req.status === 'pending' && (
          <p className="text-sm text-gray-500 mt-2">
            Waiting for {req.pro?.fullName ?? req.proName} to respond…
          </p>
        )}

        <div className={`mt-4 rounded-xl border px-4 py-3 ${
          action.needsAction
            ? 'border-orange-200 bg-orange-50 text-orange-900'
            : 'border-gray-200 bg-gray-50 text-gray-700'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-black uppercase tracking-widest ${
                action.needsAction ? 'text-orange-600' : 'text-gray-400'
              }`}>
                {action.label}
              </p>
              <p className="mt-1 text-sm font-semibold leading-5">{action.body}</p>
            </div>
            {action.needsAction && (
              <span className="shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                Now
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs font-semibold transition-colors sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/requests/${req.id}`} className="text-orange-600 hover:underline">
          View request details →
        </Link>
        {shouldOpenConversation && (
          <Link href={`/messages/${req.id}`} className="rounded-lg bg-slate-800 px-3 py-2 text-center text-white hover:bg-slate-900">
            Open conversation
          </Link>
        )}
      </div>
    </article>
  )
}

function RequestsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/requests')
        return
      }
      try {
        const snap = await getDocs(
          query(collection(db, 'serviceRequests'), where('customerUid', '==', user.uid))
        )
        const docs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ServiceRequest))
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))

        const uids = [...new Set(docs.map(d => d.proUid))]
        const pros = await Promise.all(uids.map(uid => fetchProSummary(uid)))
        const proMap = new Map(pros.filter(Boolean).map(p => [p!.uid, p!]))

        setRequests(docs.map(req => ({ ...req, pro: proMap.get(req.proUid) ?? null })))
      } catch {
        setRequests([])
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  const projectRequests = projectId
    ? requests.filter(req => req.projectId === projectId)
    : requests
  const visibleByDefault = projectRequests.filter(req => req.status !== 'cancelled')
  const statusFilteredRequests = statusFilter === 'all'
    ? visibleByDefault
    : projectRequests.filter(req => req.status === statusFilter)
  const filteredRequests = [...statusFilteredRequests].sort((a, b) => {
    const actionDelta = Number(nextAction(b).needsAction) - Number(nextAction(a).needsAction)
    if (actionDelta !== 0) return actionDelta
    return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)
  })
  const actionRequests = filteredRequests.filter(req => nextAction(req).needsAction)
  const otherRequests = filteredRequests.filter(req => !nextAction(req).needsAction)

  function countForStatus(status: RequestStatusFilter): number {
    if (status === 'all') return visibleByDefault.length
    return projectRequests.filter(req => req.status === status).length
  }

  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className={styles.title}>My requests</h1>
        <p className={styles.subtitle}>Track quotes and projects with the pros you&apos;ve contacted.</p>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white rounded-2xl border border-gray-200" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            <p className={styles.emptyTitle}>No requests yet</p>
            <p>Find a pro and submit a project to get started.</p>
            <Link href="/" className={styles.linkBtn}>
              Explore services
            </Link>
          </div>
        ) : (
          <>
            {projectId && (
              <div className="mb-5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">Showing requests for one project.</span>
                  <Link href="/requests" className="font-bold text-orange-700 hover:underline">
                    Clear project filter
                  </Link>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5" aria-label="Filter requests by status">
              {REQUEST_STATUS_FILTERS.map(filter => {
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

            {filteredRequests.length === 0 ? (
              <div className={`${styles.card} ${styles.empty}`}>
                <p className={styles.emptyTitle}>No {REQUEST_STATUS_FILTERS.find(f => f.id === statusFilter)?.label.toLowerCase()} requests</p>
                <p>{projectId ? 'This project has no requests in that status.' : 'Choose another status to see different requests.'}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {actionRequests.length > 0 && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-widest text-orange-500">Needs your action</span>
                      <span className="h-px flex-1 bg-orange-100" />
                    </div>
                    {actionRequests.map(req => (
                      <RequestCard key={req.id} req={req} />
                    ))}
                  </>
                )}

                {otherRequests.length > 0 && (
                  <>
                    {actionRequests.length > 0 && (
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Other requests</span>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}
                    {otherRequests.map(req => (
                      <RequestCard key={req.id} req={req} />
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function RequestsPage() {
  return (
    <Suspense fallback={(
      <main className="bg-gray-50 min-h-screen flex-1">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <h1 className={styles.title}>My requests</h1>
          <p className={styles.subtitle}>Track quotes and projects with the pros you&apos;ve contacted.</p>
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white rounded-2xl border border-gray-200" />
            ))}
          </div>
        </div>
      </main>
    )}>
      <RequestsPageContent />
    </Suspense>
  )
}

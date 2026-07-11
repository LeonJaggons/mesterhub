'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MdLocationOn } from 'react-icons/md'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import styles from '../account/account.module.css'
import {
  dg,
  districtLabel,
  fetchProSummary,
  timestampMillis,
  type ProSummary,
  type ServiceRequest,
} from './shared'
import { ProListSnippet } from './components/ProCard'
import CustomerActivityTabs from '@/app/components/CustomerActivityTabs'
import { StatusPill } from '@/app/components/ui/StatusPill'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type EnrichedRequest = ServiceRequest & { pro: ProSummary | null }
type RequestStatusFilter = 'all' | ServiceRequest['status']
type Translator = ReturnType<typeof useTranslations>

const REQUEST_STATUS_FILTERS: Array<{ id: RequestStatusFilter; labelKey: string }> = [
  { id: 'all', labelKey: 'active' },
  { id: 'pending', labelKey: 'pending' },
  { id: 'quoted', labelKey: 'quoted' },
  { id: 'accepted', labelKey: 'accepted' },
  { id: 'completed', labelKey: 'completed' },
  { id: 'declined', labelKey: 'declined' },
  { id: 'cancelled', labelKey: 'cancelled' },
]

function requestStatusLabel(t: Translator, status: ServiceRequest['status'], declinedBy?: 'pro' | 'customer'): string {
  if (status === 'declined' && declinedBy === 'customer') return t('customerRequests.status.youDeclined')
  if (status === 'declined' && declinedBy === 'pro') return t('customerRequests.status.declinedByPro')
  return t(`customerRequests.status.${status}`)
}

function timeAgo(t: Translator, ts: ServiceRequest['createdAt']): string {
  const millis = timestampMillis(ts)
  if (!millis) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return t('customerRequests.time.justNow')
  if (seconds < 3600) return t('customerRequests.time.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('customerRequests.time.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('customerRequests.time.daysAgo', { count: Math.floor(seconds / 86400) })
}

function nextAction(t: Translator, req: EnrichedRequest): { label: string; body: string; needsAction: boolean } {
  if (req.status === 'quoted') {
    return {
      label: t('customerRequests.actions.actionNeeded'),
      body: t('customerRequests.actions.reviewQuote'),
      needsAction: true,
    }
  }
  if (req.status === 'accepted' && req.appointmentChangeRequest) {
    return {
      label: t('customerRequests.actions.actionNeeded'),
      body: t('customerRequests.actions.reviewAppointmentChange'),
      needsAction: true,
    }
  }
  if (req.status === 'accepted' && req.appointmentRequest?.status === 'proposed') {
    return {
      label: t('customerRequests.actions.actionNeeded'),
      body: t('customerRequests.actions.confirmAppointment'),
      needsAction: true,
    }
  }
  if (req.status === 'accepted' && req.completion?.status === 'pro_marked_complete') {
    return {
      label: t('customerRequests.actions.actionNeeded'),
      body: t('customerRequests.actions.confirmCompletion'),
      needsAction: true,
    }
  }
  if (req.status === 'pending') {
    return {
      label: t('customerRequests.actions.nextStep'),
      body: t('customerRequests.actions.waitingForQuote', { name: req.pro?.fullName ?? req.proName }),
      needsAction: false,
    }
  }
  if (req.status === 'accepted') {
    return {
      label: t('customerRequests.actions.actionNeeded'),
      body: req.appointmentRequest?.status === 'confirmed'
        ? t('customerRequests.actions.appointmentConfirmed')
        : t('customerRequests.actions.coordinateDetails'),
      needsAction: req.appointmentRequest?.status !== 'confirmed',
    }
  }
  if (req.status === 'completed') {
    return {
      label: t('customerRequests.actions.closed'),
      body: t('customerRequests.actions.jobComplete'),
      needsAction: false,
    }
  }
  if (req.status === 'declined') {
    return {
      label: t('customerRequests.actions.closed'),
      body: requestStatusLabel(t, req.status, req.declinedBy),
      needsAction: false,
    }
  }
  return {
    label: t('customerRequests.actions.closed'),
    body: req.cancelReason ? t('customerRequests.actions.cancelledWithReason', { reason: req.cancelReason }) : t('customerRequests.actions.cancelled'),
    needsAction: false,
  }
}

function RequestCard({
  req,
  onDelete,
  isDeleting,
}: {
  req: EnrichedRequest
  onDelete: (req: EnrichedRequest) => void
  isDeleting: boolean
}) {
  const t = useTranslations()
  const district = req.customerDistrict ? districtLabel(req.customerDistrict) : null
  const action = nextAction(t, req)
  const shouldOpenConversation = req.status === 'accepted' && req.appointmentRequest?.status !== 'confirmed'
  const hasAppointment = Boolean(req.appointmentRequest || req.appointmentChangeRequest)
  const canDelete = req.status !== 'completed' && !hasAppointment

  return (
    <article className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md hover:border-slate-300">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          {req.pro ? (
            <ProListSnippet pro={req.pro} />
          ) : (
            <div>
              <p className="font-bold text-gray-900" style={dg}>{req.proName || t('customerRequests.card.proFallback')}</p>
              <p className="text-xs text-gray-500">{translateCategory(t, req.categoryName)}</p>
            </div>
          )}
          <StatusPill status={req.status}>
            {requestStatusLabel(t, req.status, req.declinedBy)}
          </StatusPill>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-full px-2.5 py-1">
            {translateCategory(t, req.categoryName)}
          </span>
          {district && (
            <span className="inline-flex items-center gap-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full px-2.5 py-1">
              <MdLocationOn size={13} />
              {district}
            </span>
          )}
          <span className="text-xs text-gray-400 rounded-full px-2 py-1">{timeAgo(t, req.createdAt)}</span>
        </div>

        {req.quote && (req.status === 'quoted' || req.status === 'accepted') && (
          <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
            <p className="text-xs text-slate-800 font-semibold uppercase tracking-wide mb-0.5">{t('customerRequests.card.quote')}</p>
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
            {t('customerRequests.card.waitingForResponse', { name: req.pro?.fullName ?? req.proName })}
          </p>
        )}

        <div className={`mt-4 rounded-md border px-4 py-3 ${
          action.needsAction
            ? 'border-sky-200 bg-sky-50 text-sky-900'
            : 'border-gray-200 bg-gray-50 text-gray-700'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-xs font-black uppercase tracking-widest ${
                action.needsAction ? 'text-sky-600' : 'text-gray-400'
              }`}>
                {action.label}
              </p>
              <p className="mt-1 text-sm font-semibold leading-5">{action.body}</p>
            </div>
            {action.needsAction && (
              <span className="shrink-0 rounded-full bg-sky-500 px-2 py-0.5 text-xs font-bold text-white">
                {t('customerRequests.card.now')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs font-semibold transition-colors sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/requests/${req.id}`} className="text-slate-700 hover:underline">
          {t('customerRequests.card.viewDetails')}
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {shouldOpenConversation && (
            <Link href={`/messages/${req.id}`} className="rounded bg-slate-800 px-3 py-2 text-center text-white hover:bg-slate-900">
              {t('customerRequests.card.openConversation')}
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(req)}
              disabled={isDeleting}
              className="rounded border border-red-200 bg-white px-3 py-2 text-center text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              {isDeleting ? t('customerRequests.card.deleting') : t('customerRequests.card.delete')}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

function RequestsPageContent() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId') ?? ''
  const [requests, setRequests] = useState<EnrichedRequest[]>([])
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/requests')
        return
      }
      try {
        const response = await authenticatedFetch('/api/service-requests')
        const data = (await response.json()) as { requests?: ServiceRequest[] }
        const docs = (data.requests ?? [])
          .sort((a, b) => (timestampMillis(b.createdAt) ?? 0) - (timestampMillis(a.createdAt) ?? 0))

        const uids = [...new Set(docs.map(d => d.proUid))]
        const pros = await Promise.all(uids.map(uid => fetchProSummary(uid)))
        const proMap = new Map(pros.filter(Boolean).map(p => [p!.uid, p!]))

        setRequests(
          docs
            .filter(req => !('customerDeletedAt' in req))
            .map(req => ({ ...req, pro: proMap.get(req.proUid) ?? null })),
        )
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
    const actionDelta = Number(nextAction(t, b).needsAction) - Number(nextAction(t, a).needsAction)
    if (actionDelta !== 0) return actionDelta
    return (timestampMillis(b.createdAt) ?? 0) - (timestampMillis(a.createdAt) ?? 0)
  })
  const actionRequests = filteredRequests.filter(req => nextAction(t, req).needsAction)
  const otherRequests = filteredRequests.filter(req => !nextAction(t, req).needsAction)

  function countForStatus(status: RequestStatusFilter): number {
    if (status === 'all') return visibleByDefault.length
    return projectRequests.filter(req => req.status === status).length
  }

  async function handleDeleteRequest(req: EnrichedRequest) {
    if (req.status === 'completed') {
      setDeleteError(t('customerRequests.delete.completed'))
      return
    }
    if (req.appointmentRequest || req.appointmentChangeRequest) {
      setDeleteError(t('customerRequests.delete.hasAppointment'))
      return
    }
    const active = req.status === 'pending' || req.status === 'quoted' || req.status === 'accepted'
    const confirmed = window.confirm(
      active
        ? t('customerRequests.delete.confirmActive')
        : t('customerRequests.delete.confirm'),
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeletingRequestId(req.id)
    try {
      await authenticatedFetch(`/api/service-requests/${req.id}`, { method: 'DELETE' })
      setRequests(prev => prev.filter(item => item.id !== req.id))
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('customerRequests.delete.error'))
    } finally {
      setDeletingRequestId(null)
    }
  }

  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className={styles.title}>{t('customerRequests.header.title')}</h1>
        <p className={styles.subtitle}>{t('customerRequests.header.subtitle')}</p>
        <CustomerActivityTabs />

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-white rounded-lg border border-gray-200" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            <p className={styles.emptyTitle}>{t('customerRequests.empty.title')}</p>
            <p>{t('customerRequests.empty.body')}</p>
            <Link href="/" className={styles.linkBtn}>
              {t('customerRequests.empty.cta')}
            </Link>
          </div>
        ) : (
          <>
            {deleteError && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {deleteError}
              </div>
            )}

            {projectId && (
              <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold">{t('customerRequests.projectFilter.showing')}</span>
                  <Link href="/requests" className="font-bold text-slate-800 hover:underline">
                    {t('customerRequests.projectFilter.clear')}
                  </Link>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mb-5" aria-label={t('customerRequests.filters.aria')}>
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
                        ? 'bg-slate-800 border-slate-800 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-pressed={active}
                  >
                    {t(`customerRequests.filters.${filter.labelKey}`)} <span className={active ? 'text-slate-200' : 'text-gray-400'}>{count}</span>
                  </button>
                )
              })}
            </div>

            {filteredRequests.length === 0 ? (
              <div className={`${styles.card} ${styles.empty}`}>
                <p className={styles.emptyTitle}>
                  {t('customerRequests.emptyStatus.title', { status: t(`customerRequests.filters.${REQUEST_STATUS_FILTERS.find(f => f.id === statusFilter)?.labelKey ?? 'active'}`).toLowerCase() })}
                </p>
                <p>{projectId ? t('customerRequests.emptyStatus.projectBody') : t('customerRequests.emptyStatus.body')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {actionRequests.length > 0 && (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-widest text-sky-500">{t('customerRequests.sections.needsAction')}</span>
                      <span className="h-px flex-1 bg-sky-100" />
                    </div>
                    {actionRequests.map(req => (
                      <RequestCard
                        key={req.id}
                        req={req}
                        onDelete={handleDeleteRequest}
                        isDeleting={deletingRequestId === req.id}
                      />
                    ))}
                  </>
                )}

                {otherRequests.length > 0 && (
                  <>
                    {actionRequests.length > 0 && (
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{t('customerRequests.sections.other')}</span>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                    )}
                    {otherRequests.map(req => (
                      <RequestCard
                        key={req.id}
                        req={req}
                        onDelete={handleDeleteRequest}
                        isDeleting={deletingRequestId === req.id}
                      />
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

function RequestsLoadingFallback() {
  const t = useTranslations()
  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className={styles.title}>{t('customerRequests.header.title')}</h1>
        <p className={styles.subtitle}>{t('customerRequests.header.subtitle')}</p>
        <CustomerActivityTabs />
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-white rounded-lg border border-gray-200" />
          ))}
        </div>
      </div>
    </main>
  )
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<RequestsLoadingFallback />}>
      <RequestsPageContent />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type Report = {
  id: string
  status?: string
  reason?: string
  details?: string
  contextType?: string
  path?: string
  requestId?: string | null
  reporterUid?: string
  reporterEmail?: string | null
  reporterName?: string | null
  reporterRole?: string
  targetUid?: string
  targetRole?: string
  targetName?: string
  requestContext?: {
    categoryName?: string
    requestStatus?: string
    proUid?: string
    proName?: string
    customerUid?: string
    customerName?: string
  } | null
  createdAt?: string
  adminNote?: string
}

const statuses = ['new', 'reviewing', 'action_taken', 'resolved', 'dismissed']
const targetRoles = ['pro', 'customer', 'user']

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

function reportLink(report: Report): string {
  if (!report.requestId) return report.path || '/'
  return report.path || '/admin/requests'
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState('new')
  const [targetRole, setTargetRole] = useState('')
  const [items, setItems] = useState<Report[]>([])
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadReports(nextStatus = status, nextTargetRole = targetRole) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextStatus) params.set('status', nextStatus)
      if (nextTargetRole) params.set('targetRole', nextTargetRole)
      const res = await authenticatedFetch(`/api/admin/reports?${params}`)
      const data = await res.json()
      setItems(data.reports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reports.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadReports())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateReport(id: string, nextStatus: string) {
    setBusyId(id)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, note }),
      })
      await loadReports()
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-3xl font-black text-gray-950" style={dg}>User reports</h2>
        <p className="mt-1 text-sm text-gray-500">Review customer and pro safety reports from profiles, requests, and conversations.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select value={status} onChange={e => { setStatus(e.target.value); loadReports(e.target.value, targetRole) }} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900">
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Reported role
            <select value={targetRole} onChange={e => { setTargetRole(e.target.value); loadReports(status, e.target.value) }} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900">
              <option value="">All roles</option>
              {targetRoles.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Admin note
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note for the next action" className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900" />
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {loading ? (
        <div className="h-44 animate-pulse rounded-lg border border-gray-200 bg-white" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No reports match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map(item => (
            <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-500">{item.reason ?? 'Report'}</p>
                  <h3 className="mt-1 text-2xl font-black text-gray-950" style={dg}>
                    {item.targetName || item.targetUid || 'Reported user'}
                  </h3>
                  <p className="mt-1 text-sm font-semibold capitalize text-gray-500">
                    Reported {item.targetRole ?? 'user'} from {statusLabel(item.contextType ?? 'unknown')}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{statusLabel(item.status ?? 'new')}</span>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{item.details}</p>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-gray-400">Reporter</dt><dd className="font-semibold text-gray-800">{item.reporterName || item.reporterEmail || item.reporterUid || '-'}</dd></div>
                <div><dt className="text-gray-400">Reporter role</dt><dd className="font-semibold text-gray-800">{item.reporterRole || '-'}</dd></div>
                <div><dt className="text-gray-400">Target UID</dt><dd className="break-all font-semibold text-gray-800">{item.targetUid || '-'}</dd></div>
                <div><dt className="text-gray-400">Request</dt><dd className="break-all font-semibold text-gray-800">{item.requestId || '-'}</dd></div>
                <div><dt className="text-gray-400">Category</dt><dd className="font-semibold text-gray-800">{item.requestContext?.categoryName || '-'}</dd></div>
                <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-800">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.requestId && (
                  <Link href="/admin/requests" className="rounded-md bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-900">
                    Open requests
                  </Link>
                )}
                {item.path && (
                  <Link href={reportLink(item)} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
                    Open source
                  </Link>
                )}
                {item.targetRole === 'pro' && item.targetUid && (
                  <Link href="/admin/pros" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">
                    Open pros
                  </Link>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {statuses.map(nextStatus => (
                  <button key={nextStatus} disabled={busyId === item.id || item.status === nextStatus} onClick={() => updateReport(item.id, nextStatus)} className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold capitalize text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-sky-50 hover:text-sky-700">
                    {statusLabel(nextStatus)}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

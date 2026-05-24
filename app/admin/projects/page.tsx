'use client'

import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type Project = {
  id: string
  categoryName?: string
  customerName?: string
  customerEmail?: string
  customerUid?: string
  customerDistrict?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  invitedProUids?: string[]
  answers?: Record<string, string>
  attachmentUrls?: string[]
}

const statuses = ['active', 'closed', 'cancelled']

export default function AdminProjectsPage() {
  const [status, setStatus] = useState('active')
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadProjects(nextStatus = status, nextQuery = query) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextStatus) params.set('status', nextStatus)
      if (nextQuery.trim()) params.set('q', nextQuery.trim())
      const res = await authenticatedFetch(`/api/admin/projects?${params}`)
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load projects.')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadProjects())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateProject(id: string, nextStatus: string) {
    setBusyId(id)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reason }),
      })
      await loadProjects()
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update project.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-3xl font-black text-gray-950" style={dg}>Projects</h2>
        <p className="mt-1 text-sm text-gray-500">Review customer project shells and update the project status used by request creation.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select value={status} onChange={e => { setStatus(e.target.value); loadProjects(e.target.value, query) }} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900">
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700 lg:col-span-2">
            Search
            <input value={query} onChange={e => setQuery(e.target.value)} onBlur={() => loadProjects(status, query)} placeholder="Name, email, category, district, or UID" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Admin reason
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900" />
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {loading ? (
        <div className="h-44 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">No projects match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {projects.map(item => (
            <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-950" style={dg}>{item.categoryName || 'Project'}</h3>
                  <p className="text-sm text-gray-500">{item.customerName || 'Customer'} · {item.customerEmail || 'No email'}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status}</span>
              </div>
              <p className="mt-4 text-sm text-gray-700">{item.answers?.project_details || 'No project details.'}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-400">District</dt><dd className="font-semibold text-gray-900">{item.customerDistrict || '-'}</dd></div>
                <div><dt className="text-gray-400">Invited pros</dt><dd className="font-semibold text-gray-900">{item.invitedProUids?.length ?? 0}</dd></div>
                <div><dt className="text-gray-400">Attachments</dt><dd className="font-semibold text-gray-900">{item.attachmentUrls?.length ?? 0}</dd></div>
                <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-900">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {statuses.map(nextStatus => (
                  <button key={nextStatus} disabled={busyId === item.id || item.status === nextStatus} onClick={() => updateProject(item.id, nextStatus)} className="cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold capitalize text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-orange-50 hover:text-orange-700">
                    {nextStatus}
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

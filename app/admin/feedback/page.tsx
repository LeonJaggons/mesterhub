'use client'

import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type Feedback = {
  id: string
  type?: string
  status?: string
  message?: string
  path?: string
  email?: string
  userUid?: string
  viewport?: string
  createdAt?: string
  adminNote?: string
}

const statuses = ['new', 'reviewing', 'planned', 'resolved', 'closed']
const types = ['problem', 'feature', 'general']

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState('new')
  const [type, setType] = useState('')
  const [items, setItems] = useState<Feedback[]>([])
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadFeedback(nextStatus = status, nextType = type) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextStatus) params.set('status', nextStatus)
      if (nextType) params.set('type', nextType)
      const res = await authenticatedFetch(`/api/admin/feedback?${params}`)
      const data = await res.json()
      setItems(data.feedback ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load feedback.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadFeedback())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateFeedback(id: string, nextStatus: string) {
    setBusyId(id)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, note }),
      })
      await loadFeedback()
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update feedback.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-3xl font-black text-gray-950" style={dg}>Feedback triage</h2>
        <p className="mt-1 text-sm text-gray-500">Review reports from the MVP feedback button and track follow-up state.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select value={status} onChange={e => { setStatus(e.target.value); loadFeedback(e.target.value, type) }} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900">
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Type
            <select value={type} onChange={e => { setType(e.target.value); loadFeedback(status, e.target.value) }} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900">
              <option value="">All types</option>
              {types.map(item => <option key={item} value={item}>{item}</option>)}
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
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">No feedback matches these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map(item => (
            <article key={item.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-500">{item.type ?? 'feedback'}</p>
                  <h3 className="mt-1 text-2xl font-black text-gray-950" style={dg}>{item.path || 'Unknown page'}</h3>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{item.message}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div><dt className="text-gray-400">Email</dt><dd className="font-semibold text-gray-800">{item.email || '-'}</dd></div>
                <div><dt className="text-gray-400">Viewport</dt><dd className="font-semibold text-gray-800">{item.viewport || '-'}</dd></div>
                <div><dt className="text-gray-400">User</dt><dd className="font-semibold text-gray-800">{item.userUid || '-'}</dd></div>
                <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-800">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {statuses.map(nextStatus => (
                  <button key={nextStatus} disabled={busyId === item.id || item.status === nextStatus} onClick={() => updateFeedback(item.id, nextStatus)} className="cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold capitalize text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-sky-50 hover:text-sky-700">
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

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type ServiceRequest = {
  id: string
  proName?: string
  proUid?: string
  customerName?: string
  customerUid?: string
  customerEmail?: string
  categoryName?: string
  status?: string
  createdAt?: string
  cancelReason?: string
  quote?: { price?: string; timeline?: string }
}

const statuses = ['pending', 'quoted', 'accepted', 'declined', 'completed', 'cancelled']

function canCancel(status?: string) {
  return status === 'pending' || status === 'quoted' || status === 'accepted'
}

export default function AdminRequestsPage() {
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadRequests(nextStatus = status, nextQuery = query) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextStatus) params.set('status', nextStatus)
      if (nextQuery.trim()) params.set('q', nextQuery.trim())
      const res = await authenticatedFetch(`/api/admin/requests?${params}`)
      const data = await res.json()
      setRequests(data.serviceRequests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load requests.')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadRequests())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cancelRequest(id: string) {
    if (!reason.trim()) {
      setError('Add a cancellation reason before cancelling a request.')
      return
    }
    setBusyId(id)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'cancel', reason }),
      })
      await loadRequests()
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update request.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-3xl font-black text-gray-950" style={dg}>Service requests</h2>
        <p className="mt-1 text-sm text-gray-500">Monitor quote and job lifecycle state. Admin cancellation uses the same terminal status as user cancellation.</p>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="text-sm font-semibold text-gray-700">
            Status
            <select value={status} onChange={e => { setStatus(e.target.value); loadRequests(e.target.value, query) }} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900">
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700 lg:col-span-2">
            Search
            <input value={query} onChange={e => setQuery(e.target.value)} onBlur={() => loadRequests(status, query)} placeholder="Name, email, category, or UID" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900" />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Cancellation reason
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for cancel" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900" />
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {loading ? (
        <div className="h-44 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">No requests match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {requests.map(item => (
            <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-950" style={dg}>{item.categoryName || 'Service request'}</h3>
                  <p className="text-sm text-gray-500">{item.customerName || 'Customer'} → {item.proName || 'Pro'}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-400">Customer email</dt><dd className="font-semibold text-gray-900">{item.customerEmail || '-'}</dd></div>
                <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-900">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
                <div><dt className="text-gray-400">Quote</dt><dd className="font-semibold text-gray-900">{item.quote?.price ? `${item.quote.price} · ${item.quote.timeline ?? ''}` : '-'}</dd></div>
                <div><dt className="text-gray-400">Request ID</dt><dd className="font-mono text-xs text-gray-700">{item.id}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/messages/${item.id}`} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Customer thread</Link>
                <Link href={`/pro/messages/${item.id}`} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">Pro thread</Link>
                <button disabled={busyId === item.id || !canCancel(item.status)} onClick={() => cancelRequest(item.id)} className="cursor-pointer rounded-xl border-none bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  Cancel request
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

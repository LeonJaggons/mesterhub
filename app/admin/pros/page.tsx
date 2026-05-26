'use client'

import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type AdminPro = {
  uid: string
  fullName?: string
  categoryName?: string
  services?: string[]
  districts?: number[]
  bio?: string
  status?: string
  account?: { email?: string; phone?: string }
  verification?: {
    idDocumentUrl?: string
    selfieUrl?: string
    certificateUrl?: string
    insuranceUrl?: string
    backgroundCheck?: boolean
    regulated?: boolean
  }
}

const STATUSES = [
  { id: 'pending_verification', label: 'Pending' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'rejected', label: 'Rejected' },
] as const

export default function AdminProsPage() {
  const [status, setStatus] = useState('pending_verification')
  const [pros, setPros] = useState<AdminPro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [busyUid, setBusyUid] = useState<string | null>(null)

  async function loadPros(nextStatus = status) {
    setLoading(true)
    setError('')
    try {
      const res = await authenticatedFetch(`/api/admin/pros?status=${nextStatus}`)
      const data = await res.json()
      setPros(data.pros ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pros.')
      setPros([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadPros())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function act(uid: string, action: 'approve' | 'reject' | 'suspend') {
    setBusyUid(uid)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/pros/${uid}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, reason }),
      })
      await loadPros()
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update pro.')
    } finally {
      setBusyUid(null)
    }
  }

  async function deletePro(pro: AdminPro) {
    const label = pro.fullName || pro.account?.email || pro.uid
    const confirmed = window.confirm(
      `Delete ${label}? This permanently removes the pro account, requests, appointments, conversations, quotes, reviews, notifications, and uploaded pro files.`,
    )
    if (!confirmed) return

    setBusyUid(pro.uid)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/pros/${pro.uid}`, { method: 'DELETE' })
      await loadPros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete pro.')
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-950" style={dg}>Pro verification</h2>
            <p className="mt-1 text-sm text-gray-500">Review providers and control who appears in search.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-gray-700">
            Status
            <select
              value={status}
              onChange={e => {
                setStatus(e.target.value)
                loadPros(e.target.value)
              }}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900"
            >
              {STATUSES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex-[2] text-sm font-semibold text-gray-700">
            Review note
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900"
              placeholder="Reason for rejection or suspension"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {loading ? (
        <div className="h-44 animate-pulse rounded-2xl border border-gray-200 bg-white" />
      ) : pros.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          No pros with this status.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {pros.map(pro => (
            <article key={pro.uid} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-950" style={dg}>{pro.fullName || 'Unnamed pro'}</h3>
                  <p className="text-sm text-gray-500">{pro.categoryName || 'No category'} · {pro.account?.email || 'No email'}</p>
                </div>
                <span className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                  {pro.status}
                </span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{pro.bio || 'No bio provided.'}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-400">Services</dt><dd className="font-semibold text-gray-900">{pro.services?.join(', ') || '-'}</dd></div>
                <div><dt className="text-gray-400">Districts</dt><dd className="font-semibold text-gray-900">{pro.districts?.join(', ') || '-'}</dd></div>
                <div><dt className="text-gray-400">Phone</dt><dd className="font-semibold text-gray-900">{pro.account?.phone || '-'}</dd></div>
                <div><dt className="text-gray-400">Background</dt><dd className="font-semibold text-gray-900">{pro.verification?.backgroundCheck ? 'Requested' : 'Not requested'}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {[
                  ['ID document', pro.verification?.idDocumentUrl],
                  ['Selfie', pro.verification?.selfieUrl],
                  ['Certificate', pro.verification?.certificateUrl],
                  ['Insurance', pro.verification?.insuranceUrl],
                ].map(([label, url]) => url ? (
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="font-semibold text-orange-600 hover:underline">{label}</a>
                ) : null)}
              </div>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <button disabled={busyUid === pro.uid} onClick={() => act(pro.uid, 'approve')} className="cursor-pointer rounded-xl border-none bg-orange-500 py-2.5 font-bold text-white disabled:opacity-60">Approve</button>
                <button disabled={busyUid === pro.uid} onClick={() => act(pro.uid, 'reject')} className="cursor-pointer rounded-xl border border-gray-200 bg-white py-2.5 font-semibold text-gray-700 disabled:opacity-60">Reject</button>
                <button disabled={busyUid === pro.uid} onClick={() => act(pro.uid, 'suspend')} className="cursor-pointer rounded-xl border-none bg-slate-800 py-2.5 font-semibold text-white disabled:opacity-60">Suspend</button>
                <button disabled={busyUid === pro.uid} onClick={() => deletePro(pro)} className="cursor-pointer rounded-xl border border-red-200 bg-red-50 py-2.5 font-semibold text-red-700 disabled:opacity-60">Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'
import { StatusPill } from '@/app/components/ui/StatusPill'
import type { ServiceRequestStatus } from '@/firebase/serviceRequests'
import {
  useAdminList,
  AdminSection,
  AdminField,
  AdminSelect,
  AdminInput,
  AdminListState,
  AdminCard,
  AdminCardHeader,
  ADMIN_LINK_BUTTON_CLASSES,
} from '@/app/components/ui/AdminList'


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
  const [busyId, setBusyId] = useState<string | null>(null)
  const { items: requests, loading, error, setError, load: loadRequests } = useAdminList<ServiceRequest>('/api/admin/requests', 'serviceRequests')

  useEffect(() => {
    void loadRequests({ status, q: query })
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
      await loadRequests({ status, q: query })
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update request.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AdminSection title="Service requests" subtitle="Monitor quote and job lifecycle state. Admin cancellation uses the same terminal status as user cancellation." error={error}>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <AdminField label="Status">
            <AdminSelect value={status} onChange={e => { setStatus(e.target.value); loadRequests({ status: e.target.value, q: query }) }}>
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{item}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Search" className="lg:col-span-2">
            <AdminInput value={query} onChange={e => setQuery(e.target.value)} onBlur={() => loadRequests({ status, q: query })} placeholder="Name, email, category, or UID" />
          </AdminField>
          <AdminField label="Cancellation reason">
            <AdminInput value={reason} onChange={e => setReason(e.target.value)} placeholder="Required for cancel" />
          </AdminField>
        </div>
      </AdminSection>

      <AdminListState loading={loading} empty={requests.length === 0} emptyMessage="No requests match these filters." gridClassName="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {requests.map(item => (
          <AdminCard key={item.id}>
            <AdminCardHeader
              title={item.categoryName || 'Service request'}
              subtitle={`${item.customerName || 'Customer'} → ${item.proName || 'Pro'}`}
              badge={item.status && (statuses as string[]).includes(item.status) ? (
                <StatusPill status={item.status as ServiceRequestStatus} className="capitalize">{item.status}</StatusPill>
              ) : (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status ?? 'Unknown'}</span>
              )}
            />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-400">Customer email</dt><dd className="font-semibold text-gray-900">{item.customerEmail || '-'}</dd></div>
              <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-900">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
              <div><dt className="text-gray-400">Quote</dt><dd className="font-semibold text-gray-900">{item.quote?.price ? `${item.quote.price} · ${item.quote.timeline ?? ''}` : '-'}</dd></div>
              <div><dt className="text-gray-400">Request ID</dt><dd className="font-mono text-xs text-gray-700">{item.id}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/messages/${item.id}`} className={ADMIN_LINK_BUTTON_CLASSES}>Customer thread</Link>
              <Link href={`/pro/messages/${item.id}`} className={ADMIN_LINK_BUTTON_CLASSES}>Pro thread</Link>
              <button disabled={busyId === item.id || !canCancel(item.status)} onClick={() => cancelRequest(item.id)} className="cursor-pointer rounded-md border-none bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                Cancel request
              </button>
            </div>
          </AdminCard>
        ))}
      </AdminListState>
    </>
  )
}

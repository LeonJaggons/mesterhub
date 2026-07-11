'use client'

import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'
import {
  useAdminList,
  AdminSection,
  AdminField,
  AdminSelect,
  AdminInput,
  AdminListState,
  AdminCard,
  AdminCardHeader,
  AdminActionButton,
} from '@/app/components/ui/AdminList'


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
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { items, loading, error, setError, load: loadFeedback } = useAdminList<Feedback>('/api/admin/feedback', 'feedback')

  useEffect(() => {
    void loadFeedback({ status, type })
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
      await loadFeedback({ status, type })
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update feedback.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AdminSection title="Feedback triage" subtitle="Review reports from the MVP feedback button and track follow-up state." error={error}>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <AdminField label="Status">
            <AdminSelect value={status} onChange={e => { setStatus(e.target.value); loadFeedback({ status: e.target.value, type }) }}>
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{item}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Type">
            <AdminSelect value={type} onChange={e => { setType(e.target.value); loadFeedback({ status, type: e.target.value }) }}>
              <option value="">All types</option>
              {types.map(item => <option key={item} value={item}>{item}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Admin note">
            <AdminInput value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note for the next action" />
          </AdminField>
        </div>
      </AdminSection>

      <AdminListState loading={loading} empty={items.length === 0} emptyMessage="No feedback matches these filters." gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map(item => (
          <AdminCard key={item.id}>
            <AdminCardHeader
              eyebrow={item.type ?? 'feedback'}
              title={item.path || 'Unknown page'}
              badge={<span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status}</span>}
            />
            <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{item.message}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-gray-400">Email</dt><dd className="font-semibold text-gray-800">{item.email || '-'}</dd></div>
              <div><dt className="text-gray-400">Viewport</dt><dd className="font-semibold text-gray-800">{item.viewport || '-'}</dd></div>
              <div><dt className="text-gray-400">User</dt><dd className="font-semibold text-gray-800">{item.userUid || '-'}</dd></div>
              <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-800">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {statuses.map(nextStatus => (
                <AdminActionButton key={nextStatus} disabled={busyId === item.id || item.status === nextStatus} onClick={() => updateFeedback(item.id, nextStatus)}>
                  {nextStatus}
                </AdminActionButton>
              ))}
            </div>
          </AdminCard>
        ))}
      </AdminListState>
    </>
  )
}

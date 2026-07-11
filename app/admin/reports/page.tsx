'use client'

import Link from 'next/link'
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
  ADMIN_LINK_BUTTON_CLASSES,
} from '@/app/components/ui/AdminList'


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
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const { items, loading, error, setError, load: loadReports } = useAdminList<Report>('/api/admin/reports', 'reports')

  useEffect(() => {
    void loadReports({ status, targetRole })
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
      await loadReports({ status, targetRole })
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update report.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AdminSection title="User reports" subtitle="Review customer and pro safety reports from profiles, requests, and conversations." error={error}>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <AdminField label="Status">
            <AdminSelect value={status} onChange={e => { setStatus(e.target.value); loadReports({ status: e.target.value, targetRole }) }}>
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Reported role">
            <AdminSelect value={targetRole} onChange={e => { setTargetRole(e.target.value); loadReports({ status, targetRole: e.target.value }) }}>
              <option value="">All roles</option>
              {targetRoles.map(item => <option key={item} value={item}>{item}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Admin note">
            <AdminInput value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note for the next action" />
          </AdminField>
        </div>
      </AdminSection>

      <AdminListState loading={loading} empty={items.length === 0} emptyMessage="No reports match these filters." gridClassName="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map(item => (
          <AdminCard key={item.id}>
            <AdminCardHeader
              eyebrow={item.reason ?? 'Report'}
              eyebrowClassName="text-red-500"
              title={item.targetName || item.targetUid || 'Reported user'}
              subtitle={`Reported ${item.targetRole ?? 'user'} from ${statusLabel(item.contextType ?? 'unknown')}`}
              badge={<span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{statusLabel(item.status ?? 'new')}</span>}
            />

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
                <Link href={reportLink(item)} className={ADMIN_LINK_BUTTON_CLASSES}>
                  Open source
                </Link>
              )}
              {item.targetRole === 'pro' && item.targetUid && (
                <Link href="/admin/pros" className={ADMIN_LINK_BUTTON_CLASSES}>
                  Open pros
                </Link>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {statuses.map(nextStatus => (
                <AdminActionButton key={nextStatus} disabled={busyId === item.id || item.status === nextStatus} onClick={() => updateReport(item.id, nextStatus)}>
                  {statusLabel(nextStatus)}
                </AdminActionButton>
              ))}
            </div>
          </AdminCard>
        ))}
      </AdminListState>
    </>
  )
}

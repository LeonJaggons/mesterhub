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
  const [busyId, setBusyId] = useState<string | null>(null)
  const { items: projects, loading, error, setError, load: loadProjects } = useAdminList<Project>('/api/admin/projects', 'projects')

  useEffect(() => {
    void loadProjects({ status, q: query })
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
      await loadProjects({ status, q: query })
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update project.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AdminSection title="Projects" subtitle="Review customer project shells and update the project status used by request creation." error={error}>
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <AdminField label="Status">
            <AdminSelect value={status} onChange={e => { setStatus(e.target.value); loadProjects({ status: e.target.value, q: query }) }}>
              <option value="">All statuses</option>
              {statuses.map(item => <option key={item} value={item}>{item}</option>)}
            </AdminSelect>
          </AdminField>
          <AdminField label="Search" className="lg:col-span-2">
            <AdminInput value={query} onChange={e => setQuery(e.target.value)} onBlur={() => loadProjects({ status, q: query })} placeholder="Name, email, category, district, or UID" />
          </AdminField>
          <AdminField label="Admin reason">
            <AdminInput value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason" />
          </AdminField>
        </div>
      </AdminSection>

      <AdminListState loading={loading} empty={projects.length === 0} emptyMessage="No projects match these filters." gridClassName="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {projects.map(item => (
          <AdminCard key={item.id}>
            <AdminCardHeader
              title={item.categoryName || 'Project'}
              subtitle={`${item.customerName || 'Customer'} · ${item.customerEmail || 'No email'}`}
              badge={<span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status}</span>}
            />
            <p className="mt-4 text-sm text-gray-700">{item.answers?.project_details || 'No project details.'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-gray-400">District</dt><dd className="font-semibold text-gray-900">{item.customerDistrict || '-'}</dd></div>
              <div><dt className="text-gray-400">Invited pros</dt><dd className="font-semibold text-gray-900">{item.invitedProUids?.length ?? 0}</dd></div>
              <div><dt className="text-gray-400">Attachments</dt><dd className="font-semibold text-gray-900">{item.attachmentUrls?.length ?? 0}</dd></div>
              <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-900">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap gap-2">
              {statuses.map(nextStatus => (
                <AdminActionButton key={nextStatus} disabled={busyId === item.id || item.status === nextStatus} onClick={() => updateProject(item.id, nextStatus)}>
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

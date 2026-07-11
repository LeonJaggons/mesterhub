'use client'

import { useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'
import { dg } from '@/lib/ui'


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

type ImportResult = {
  name: string
  email: string
  uid?: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

type ImportProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'row_start'; index: number; total: number; name: string; email: string }
  | { type: 'step'; index: number; total: number; name: string; email: string; step: string; message: string }
  | { type: 'result'; index: number; total: number; result: ImportResult }
  | { type: 'done'; imported: number; updated: number; skipped: number; failed: number; results: ImportResult[] }
  | { type: 'error'; message: string }

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
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCursors, setPageCursors] = useState<string[]>([''])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [reason, setReason] = useState('')
  const [busyUid, setBusyUid] = useState<string | null>(null)
  const [passwordByUid, setPasswordByUid] = useState<Record<string, string>>({})
  const [passwordMessage, setPasswordMessage] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importStatus, setImportStatus] = useState('active')
  const [imageDelayMs, setImageDelayMs] = useState('1200')
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState('')
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [importCurrent, setImportCurrent] = useState(0)
  const [importTotal, setImportTotal] = useState(0)
  const [importLog, setImportLog] = useState<string[]>([])

  async function loadPros(
    nextStatus = status,
    cursor = pageCursors[pageIndex] ?? '',
    nextPageIndex = pageIndex,
  ) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ status: nextStatus })
      if (cursor) params.set('cursor', cursor)
      const res = await authenticatedFetch(`/api/admin/pros?${params.toString()}`)
      const data = await res.json()
      setPros(data.pros ?? [])
      setHasNextPage(Boolean(data.hasMore))
      setNextCursor(data.nextCursor ?? null)
      setPageIndex(nextPageIndex)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pros.')
      setPros([])
      setHasNextPage(false)
      setNextCursor(null)
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

  async function setProPassword(pro: AdminPro) {
    const password = passwordByUid[pro.uid]?.trim() ?? ''
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    const label = pro.fullName || pro.account?.email || pro.uid
    const confirmed = window.confirm(`Set a new password for ${label}? This will revoke existing sessions.`)
    if (!confirmed) return

    setBusyUid(pro.uid)
    setError('')
    setPasswordMessage('')
    try {
      await authenticatedFetch(`/api/admin/pros/${pro.uid}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      })
      setPasswordByUid(previous => ({ ...previous, [pro.uid]: '' }))
      setPasswordMessage(`Password updated for ${label}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setBusyUid(null)
    }
  }

  async function importQjobPros() {
    if (!importFile) {
      setError('Choose a Qjob JSON file first.')
      return
    }

    setImporting(true)
    setError('')
    setImportSummary('')
    setImportResults([])
    setImportCurrent(0)
    setImportTotal(0)
    setImportLog([])
    try {
      const form = new FormData()
      form.set('file', importFile)
      form.set('status', importStatus)
      form.set('imageDelayMs', imageDelayMs)

      const res = await authenticatedFetch('/api/admin/pros/import', {
        method: 'POST',
        body: form,
      })
      if (!res.body) {
        throw new Error('Import response did not include progress stream.')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const appendLog = (line: string) => {
        setImportLog(previous => [...previous.slice(-199), line])
      }
      const handleEvent = (event: ImportProgressEvent) => {
        if (event.type === 'start') {
          setImportTotal(event.total)
          appendLog(`Starting import of ${event.total} executor records.`)
        } else if (event.type === 'row_start') {
          setImportCurrent(event.index)
          setImportTotal(event.total)
          appendLog(`[${event.index}/${event.total}] ${event.name || 'Unnamed'} -> ${event.email}`)
        } else if (event.type === 'step') {
          setImportCurrent(event.index)
          appendLog(`[${event.index}/${event.total}] ${event.step}: ${event.message}`)
        } else if (event.type === 'result') {
          setImportResults(previous => [...previous, event.result])
          appendLog(`[${event.index}/${event.total}] ${event.result.status}: ${event.result.name || event.result.email}${event.result.message ? ` (${event.result.message})` : ''}`)
        } else if (event.type === 'done') {
          setImportSummary(
            `Created ${event.imported}, updated ${event.updated}, skipped ${event.skipped}, failed ${event.failed}.`,
          )
          setImportResults(event.results)
          appendLog('Import complete.')
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      }

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          handleEvent(JSON.parse(line) as ImportProgressEvent)
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        handleEvent(JSON.parse(buffer) as ImportProgressEvent)
      }

      await loadPros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import Qjob pros.')
    } finally {
      setImporting(false)
    }
  }

  async function changeStatus(nextStatus: string) {
    setStatus(nextStatus)
    setPageCursors([''])
    setPageIndex(0)
    await loadPros(nextStatus, '', 0)
  }

  async function goToPreviousPage() {
    if (pageIndex === 0) return
    const previousIndex = pageIndex - 1
    await loadPros(status, pageCursors[previousIndex] ?? '', previousIndex)
  }

  async function goToNextPage() {
    if (!hasNextPage || !nextCursor) return
    const nextIndex = pageIndex + 1
    const updatedCursors = [...pageCursors]
    updatedCursors[nextIndex] = nextCursor
    setPageCursors(updatedCursors)
    await loadPros(status, nextCursor, nextIndex)
  }

  return (
    <>
      <section className="rounded-lg border border-sky-100 bg-sky-50/40 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-950" style={dg}>Import Qjob pros</h2>
            <p className="mt-1 text-sm text-gray-600">
              Upload the scraper JSON to create Firebase users and pro profiles. Emails are generated from the business name with accents stripped, ending in @mestermind.com.
            </p>
          </div>
          <button
            type="button"
            disabled={!importFile || importing}
            onClick={importQjobPros}
            className="cursor-pointer rounded-md border-none bg-sky-500 px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? 'Importing...' : 'Import JSON'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm font-semibold text-gray-700">
            Qjob JSON file
            <input
              type="file"
              accept="application/json,.json"
              onChange={event => setImportFile(event.target.files?.[0] ?? null)}
              className="mt-1 w-full rounded-md border border-sky-100 bg-white px-3 py-2 text-gray-900"
            />
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Imported status
            <select
              value={importStatus}
              onChange={event => setImportStatus(event.target.value)}
              className="mt-1 w-full rounded-md border border-sky-100 bg-white px-3 py-2 text-gray-900"
            >
              {STATUSES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-gray-700">
            Image throttle (ms)
            <input
              type="number"
              min="0"
              step="100"
              value={imageDelayMs}
              onChange={event => setImageDelayMs(event.target.value)}
              className="mt-1 w-full rounded-md border border-sky-100 bg-white px-3 py-2 text-gray-900"
            />
          </label>
        </div>

        {importSummary && <p className="mt-3 text-sm font-semibold text-green-700">{importSummary}</p>}
        {(importing || importLog.length > 0) && (
          <div className="mt-4 rounded-md border border-sky-100 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-gray-900">
                Progress {importTotal ? `${importCurrent}/${importTotal}` : ''}
              </p>
              {importing && <span className="text-xs font-semibold text-sky-700">Running...</span>}
            </div>
            {importTotal > 0 && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.min(100, Math.round((importCurrent / importTotal) * 100))}%` }}
                />
              </div>
            )}
            <div className="mt-3 max-h-56 overflow-auto rounded bg-slate-950 p-3 font-mono text-xs text-slate-100">
              {importLog.length === 0 ? (
                <div>Waiting for import progress...</div>
              ) : (
                importLog.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)
              )}
            </div>
          </div>
        )}
        {importResults.length > 0 && (
          <div className="mt-4 max-h-64 overflow-auto rounded-md border border-sky-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-sky-50 text-xs uppercase text-sky-700">
                <tr>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {importResults.slice(0, 100).map((result, index) => (
                  <tr key={`${result.email}-${index}`} className="border-t border-sky-50">
                    <td className="px-3 py-2 font-semibold text-gray-900">{result.status}</td>
                    <td className="px-3 py-2 text-gray-700">{result.name || '-'}</td>
                    <td className="px-3 py-2 text-gray-700">{result.email}</td>
                    <td className="px-3 py-2 text-gray-500">{result.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
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
                void changeStatus(e.target.value)
              }}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900"
            >
              {STATUSES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex-[2] text-sm font-semibold text-gray-700">
            Review note
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900"
              placeholder="Reason for rejection or suspension"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        {passwordMessage && <p className="mt-3 text-sm font-semibold text-green-700">{passwordMessage}</p>}
      </section>

      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-gray-700">
          Page {pageIndex + 1} · Showing {pros.length} pros
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || pageIndex === 0}
            onClick={goToPreviousPage}
            className="cursor-pointer rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={loading || !hasNextPage}
            onClick={goToNextPage}
            className="cursor-pointer rounded-md border-none bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-44 animate-pulse rounded-lg border border-gray-200 bg-white" />
      ) : pros.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No pros with this status.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {pros.map(pro => (
            <article key={pro.uid} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-950" style={dg}>{pro.fullName || 'Unnamed pro'}</h3>
                  <p className="text-sm text-gray-500">{pro.categoryName || 'No category'} · {pro.account?.email || 'No email'}</p>
                </div>
                <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
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
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="font-semibold text-sky-600 hover:underline">{label}</a>
                ) : null)}
              </div>
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-4">
                <button disabled={busyUid === pro.uid} onClick={() => act(pro.uid, 'approve')} className="cursor-pointer rounded-md border-none bg-sky-500 py-2.5 font-bold text-white disabled:opacity-60">Approve</button>
                <button disabled={busyUid === pro.uid} onClick={() => act(pro.uid, 'reject')} className="cursor-pointer rounded-md border border-gray-200 bg-white py-2.5 font-semibold text-gray-700 disabled:opacity-60">Reject</button>
                <button disabled={busyUid === pro.uid} onClick={() => act(pro.uid, 'suspend')} className="cursor-pointer rounded-md border-none bg-slate-800 py-2.5 font-semibold text-white disabled:opacity-60">Suspend</button>
                <button disabled={busyUid === pro.uid} onClick={() => deletePro(pro)} className="cursor-pointer rounded-md border border-red-200 bg-red-50 py-2.5 font-semibold text-red-700 disabled:opacity-60">Delete</button>
              </div>
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
                <label className="text-sm font-semibold text-gray-700">
                  Set account password
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={passwordByUid[pro.uid] ?? ''}
                      onChange={event => setPasswordByUid(previous => ({ ...previous, [pro.uid]: event.target.value }))}
                      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-900"
                      placeholder="Minimum 8 characters"
                    />
                    <button
                      type="button"
                      disabled={busyUid === pro.uid || (passwordByUid[pro.uid]?.trim().length ?? 0) < 8}
                      onClick={() => setProPassword(pro)}
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Set password
                    </button>
                  </div>
                </label>
                <p className="mt-2 text-xs text-gray-500">Passwords are sent directly to Firebase Auth and are not stored in Firestore.</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

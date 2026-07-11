'use client'

import { FormEvent, useEffect, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type AdminUser = {
  uid: string
  email?: string
  displayName?: string
  phoneNumber?: string
  disabled?: boolean
  createdAt?: string
  lastSignInAt?: string
  profile?: {
    firstName?: string
    lastName?: string
    preferredDistrict?: string
    address?: string
  }
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyUid, setBusyUid] = useState<string | null>(null)

  async function loadUsers(nextQuery = query) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (nextQuery.trim()) params.set('q', nextQuery.trim())
      const res = await authenticatedFetch(`/api/admin/users${params.size ? `?${params}` : ''}`)
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => loadUsers())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function search(e: FormEvent) {
    e.preventDefault()
    void loadUsers(query)
  }

  async function deleteUser(user: AdminUser) {
    const label = user.displayName || user.email || user.uid
    const confirmed = window.confirm(
      `Delete ${label}? This permanently removes the customer account, projects, requests, appointments, conversations, quotes, reviews, notifications, feedback, and uploaded request files.`,
    )
    if (!confirmed) return

    setBusyUid(user.uid)
    setError('')
    try {
      await authenticatedFetch(`/api/admin/users/${user.uid}`, { method: 'DELETE' })
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user.')
    } finally {
      setBusyUid(null)
    }
  }

  return (
    <>
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-950" style={dg}>Customers</h2>
            <p className="mt-1 text-sm text-gray-500">Find customer accounts and permanently remove their linked data when needed.</p>
          </div>
        </div>
        <form onSubmit={search} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-gray-700">
            Search
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900"
              placeholder="Name, email, phone, UID, district"
            />
          </label>
          <button className="cursor-pointer rounded-md border-none bg-sky-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={loading}>
            Search
          </button>
        </form>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {loading ? (
        <div className="h-44 animate-pulse rounded-lg border border-gray-200 bg-white" />
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No customers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {users.map(user => (
            <article key={user.uid} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-gray-950" style={dg}>{user.displayName || 'Unnamed customer'}</h3>
                  <p className="break-all text-sm text-gray-500">{user.email || 'No email'} · {user.uid}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                  user.disabled
                    ? 'border-red-100 bg-red-50 text-red-700'
                    : 'border-green-100 bg-green-50 text-green-700'
                }`}>
                  {user.disabled ? 'Disabled' : 'Active'}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-400">Phone</dt><dd className="font-semibold text-gray-900">{user.phoneNumber || '-'}</dd></div>
                <div><dt className="text-gray-400">District</dt><dd className="font-semibold text-gray-900">{user.profile?.preferredDistrict || '-'}</dd></div>
                <div><dt className="text-gray-400">Created</dt><dd className="font-semibold text-gray-900">{formatDate(user.createdAt)}</dd></div>
                <div><dt className="text-gray-400">Last sign-in</dt><dd className="font-semibold text-gray-900">{formatDate(user.lastSignInAt)}</dd></div>
              </dl>
              {user.profile?.address && (
                <p className="mt-4 text-sm text-gray-700">{user.profile.address}</p>
              )}
              <div className="mt-5">
                <button
                  disabled={busyUid === user.uid}
                  onClick={() => deleteUser(user)}
                  className="w-full cursor-pointer rounded-md border border-red-200 bg-red-50 py-2.5 font-semibold text-red-700 disabled:opacity-60"
                >
                  Delete Customer
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

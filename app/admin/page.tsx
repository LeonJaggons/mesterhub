'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type Overview = {
  totals: Record<string, number>
  prosByStatus: Record<string, number>
  requestsByStatus: Record<string, number>
  projectsByStatus: Record<string, number>
  feedbackByStatus: Record<string, number>
  reportsByStatus: Record<string, number>
  latest: {
    reports: Array<Record<string, unknown>>
    feedback: Array<Record<string, unknown>>
    serviceRequests: Array<Record<string, unknown>>
    pros: Array<Record<string, unknown>>
  }
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="mt-3 text-4xl font-black text-gray-950" style={dg}>{value}</p>
    </Link>
  )
}

function Breakdown({ title, items }: { title: string; items: Record<string, number> }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-gray-950" style={dg}>{title}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {Object.entries(items).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="font-semibold capitalize text-gray-600">{label.replaceAll('_', ' ')}</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-900">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RecentList({ title, items, empty }: { title: string; items: Array<Record<string, unknown>>; empty: string }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-gray-950" style={dg}>{title}</h2>
      <div className="mt-4 flex flex-col divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">{empty}</p>
        ) : items.map(item => (
          <div key={String(item.id)} className="py-3">
            <p className="text-sm font-bold text-gray-900">
              {String(item.fullName || item.customerName || item.targetName || item.type || item.categoryName || item.id)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {String(item.categoryName || item.reason || item.email || item.customerEmail || item.path || '')}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function TestEmailCard() {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('Mestermind test email')
  const [message, setMessage] = useState('This is a test email from the Mestermind admin panel.')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult('')
    setError('')
    try {
      const res = await authenticatedFetch('/api/admin/test-email', {
        method: 'POST',
        body: JSON.stringify({ to, subject, message }),
      })
      const data = await res.json()
      setResult(`Sent from ${data.from}${data.id ? ` (${data.id})` : ''}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send test email.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black text-gray-950" style={dg}>Send test email</h2>
      <p className="mt-1 text-sm text-gray-500">
        Sends through Resend from <span className="font-semibold text-gray-700">hello@mestermind.com</span>.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
        <label className="text-sm font-semibold text-gray-700">
          Recipient
          <input
            type="email"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="you@example.com"
            required
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Subject
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="text-sm font-semibold text-gray-700">
          Message
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            required
            className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </label>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        {result && <p className="text-sm font-semibold text-green-700">{result}</p>}
        <button
          type="submit"
          disabled={sending}
          className="rounded-xl border-none bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 cursor-pointer"
        >
          {sending ? 'Sending...' : 'Send test email'}
        </button>
      </form>
    </section>
  )
}

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    authenticatedFetch('/api/admin/overview')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setOverview(data)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load overview.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="h-64 animate-pulse rounded-3xl border border-gray-200 bg-white" />
  if (error) return <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>
  if (!overview) return null

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pros" value={overview.totals.pros ?? 0} href="/admin/pros" />
        <StatCard label="Service requests" value={overview.totals.serviceRequests ?? 0} href="/admin/requests" />
        <StatCard label="Projects" value={overview.totals.projects ?? 0} href="/admin/projects" />
        <StatCard label="Reports" value={overview.totals.reports ?? 0} href="/admin/reports" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Breakdown title="Pros" items={overview.prosByStatus} />
        <Breakdown title="Requests" items={overview.requestsByStatus} />
        <Breakdown title="Projects" items={overview.projectsByStatus} />
        <Breakdown title="Reports" items={overview.reportsByStatus} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <RecentList title="Latest pros" items={overview.latest.pros} empty="No pros yet." />
        <RecentList title="Latest requests" items={overview.latest.serviceRequests} empty="No requests yet." />
        <RecentList title="Latest reports" items={overview.latest.reports} empty="No reports yet." />
        <RecentList title="Latest feedback" items={overview.latest.feedback} empty="No feedback yet." />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TestEmailCard />
      </section>
    </>
  )
}

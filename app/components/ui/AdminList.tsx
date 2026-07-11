'use client'

import { useCallback, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'
import { dg } from '@/lib/ui'

export function useAdminList<T>(endpoint: string, resultKey: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (params: Record<string, string | undefined> = {}) => {
    setLoading(true)
    setError('')
    try {
      const search = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value && value.trim()) search.set(key, value.trim())
      }
      const qs = search.toString()
      const res = await authenticatedFetch(`${endpoint}${qs ? `?${qs}` : ''}`)
      const data = await res.json()
      setItems((data[resultKey] ?? []) as T[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load data.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [endpoint, resultKey])

  return { items, setItems, loading, error, setError, load }
}

export function AdminSection({ title, subtitle, error, children }: {
  title: string
  subtitle: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-3xl font-black text-gray-950" style={dg}>{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      {children}
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
    </section>
  )
}

export function AdminField({ label, className = '', children }: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`text-sm font-semibold text-gray-700 ${className}`}>
      {label}
      {children}
    </label>
  )
}

const ADMIN_INPUT_CLASSES = 'mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900'

export function AdminSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${ADMIN_INPUT_CLASSES} bg-white ${props.className ?? ''}`} />
}

export function AdminInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${ADMIN_INPUT_CLASSES} ${props.className ?? ''}`} />
}

export function AdminListState({ loading, empty, emptyMessage, gridClassName = 'grid grid-cols-1 gap-4 xl:grid-cols-2', children }: {
  loading: boolean
  empty: boolean
  emptyMessage: string
  gridClassName?: string
  children: React.ReactNode
}) {
  if (loading) return <div className="h-44 animate-pulse rounded-lg border border-gray-200 bg-white" />
  if (empty) return <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">{emptyMessage}</div>
  return <div className={gridClassName}>{children}</div>
}

export function AdminCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <article className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}>{children}</article>
}

export function AdminCardHeader({ eyebrow, eyebrowClassName = 'text-sky-500', title, subtitle, badge }: {
  eyebrow?: string
  eyebrowClassName?: string
  title: string
  subtitle?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        {eyebrow && <p className={`text-xs font-bold uppercase tracking-widest ${eyebrowClassName}`}>{eyebrow}</p>}
        <h3 className={`text-2xl font-black text-gray-950 ${eyebrow ? 'mt-1' : ''}`} style={dg}>{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {badge}
    </div>
  )
}

export function AdminActionButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`cursor-pointer rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold capitalize text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-sky-50 hover:text-sky-700 ${props.className ?? ''}`}
    />
  )
}

export const ADMIN_LINK_BUTTON_CLASSES = 'rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50'

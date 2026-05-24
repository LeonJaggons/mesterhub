'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { db } from '@/firebase/index'
import { onAuthChange } from '@/firebase/auth'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

type RequestDoc = {
  id: string
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  categoryName?: string
  customerName?: string
  quote?: { price?: string }
}

export default function ProEarningsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<RequestDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/pro/earnings')
        return
      }
      try {
        const snap = await getDocs(query(collection(db, 'serviceRequests'), where('proUid', '==', user.uid)))
        setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestDoc)))
      } catch {
        setRequests([])
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  const completed = requests.filter(req => req.status === 'completed')
  const active = requests.filter(req => req.status === 'accepted')

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-3">Pro dashboard</p>
        <h1 className="text-5xl font-black text-gray-900 leading-[1.05]" style={{ ...dg, letterSpacing: '-0.02em' }}>
          Earnings
        </h1>
        <p className="text-gray-500 text-base mt-2 mb-8">
          Track completed work for launch. Automated payouts will be connected after MVP validation.
        </p>

        {loading ? (
          <div className="h-40 rounded-2xl bg-white border border-gray-200 animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-black text-gray-900 text-2xl leading-none mb-4" style={dg}>Completed jobs</h2>
              {completed.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {completed.map(req => (
                    <Link key={req.id} href={`/pro/jobs/${req.id}`} className="block py-3 hover:bg-gray-50">
                      <p className="font-semibold text-gray-900">{req.categoryName ?? 'Service job'}</p>
                      <p className="text-sm text-gray-500">{req.customerName ?? 'Customer'} · {req.quote?.price ?? 'Quote on request'}</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Completed jobs will appear here after customers confirm the work.</p>
              )}
            </section>

            <aside className="flex flex-col gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-2">Summary</p>
                <p className="text-4xl font-black text-slate-800" style={dg}>{completed.length}</p>
                <p className="text-sm text-gray-500">Completed jobs</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5">
                <p className="text-sm font-bold text-orange-800 mb-1">{active.length} active job{active.length === 1 ? '' : 's'}</p>
                <p className="text-sm text-orange-700">Finish work and mark it complete to move jobs into earnings.</p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

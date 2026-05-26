'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { onAuthChange } from '@/firebase/auth'

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/pros', label: 'Pros' },
  { href: '/admin/users', label: 'Customers' },
  { href: '/admin/requests', label: 'Requests' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/feedback', label: 'Feedback' },
]

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    return onAuthChange(user => {
      if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    })
  }, [pathname, router])

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-500">Admin</p>
              <h1 className="text-4xl font-black leading-none text-gray-950 sm:text-5xl" style={{ ...dg, letterSpacing: '-0.03em' }}>
                Mestermind control panel
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-500">
                Review operational activity and use the actions already supported by the MVP.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2" aria-label="Admin navigation">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    isActive(pathname, item.href)
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
        {children}
      </div>
    </main>
  )
}

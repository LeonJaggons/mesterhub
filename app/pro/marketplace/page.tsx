'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authenticatedFetch } from '@/firebase/apiClient'
import { QuoteModal, type QuoteFormData } from '@/app/pro/jobs/JobModals'
import { dg, districtLabel, formatAnswers, timestampMillis, type TimestampLike } from '@/app/requests/shared'
import ProUpgradeCta from '@/app/pro/components/ProUpgradeCta'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type Translator = ReturnType<typeof useTranslations>

type MarketplaceProject = {
  id: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict?: string
  attachmentUrls?: string[]
  createdAt?: TimestampLike | null
  updatedAt?: TimestampLike | null
}

type MarketplaceAccess = {
  eligible: boolean
  hasProPlan: boolean
  reason?: string
}

function timeAgo(t: Translator, ts: TimestampLike | null): string {
  const millis = timestampMillis(ts)
  if (!millis) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return t('proMarketplace.time.justNow')
  if (seconds < 3600) return t('proMarketplace.time.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('proMarketplace.time.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('proMarketplace.time.daysAgo', { count: Math.floor(seconds / 86400) })
}

function projectTitle(t: Translator, project: MarketplaceProject): string {
  return project.answers.project_details
    || project.answers.task
    || project.answers.issue
    || t('proMarketplace.card.fallbackTitle', { category: translateCategory(t, project.categoryName) })
}

function shortText(value: string, max = 180): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function ProjectCard({
  project,
  onQuote,
  submitting,
}: {
  project: MarketplaceProject
  onQuote: (project: MarketplaceProject) => void
  submitting: boolean
}) {
  const t = useTranslations()
  const details = formatAnswers(project.answers).filter(item => item.key !== 'Project Details').slice(0, 4)
  const categoryLabel = translateCategory(t, project.categoryName)

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:border-slate-300 hover:shadow-md">
      <div className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proMarketplace.card.kicker')}</p>
            <h2 className="text-2xl font-black leading-none text-gray-900" style={dg}>{categoryLabel}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{shortText(projectTitle(t, project))}</p>
          </div>
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            {project.customerDistrict ? districtLabel(project.customerDistrict) : t('proMarketplace.card.districtNotShared')}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {project.attachmentUrls?.length ? (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {t(
                project.attachmentUrls.length === 1
                  ? 'proMarketplace.card.attachmentSingular'
                  : 'proMarketplace.card.attachmentPlural',
                { count: project.attachmentUrls.length }
              )}
            </span>
          ) : null}
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-400">
            {project.updatedAt
              ? t('proMarketplace.card.updated', { time: timeAgo(t, project.updatedAt) })
              : timeAgo(t, project.createdAt ?? null)}
          </span>
        </div>

        {details.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map(detail => (
              <div key={detail.key} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <p className="mb-1 text-xs text-gray-400">{detail.key}</p>
                <p className="text-sm font-semibold text-gray-900">{detail.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
        <button
          type="button"
          onClick={() => onQuote(project)}
          disabled={submitting}
          className="w-full rounded bg-slate-800 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? t('proMarketplace.card.sendingQuote') : t('proMarketplace.card.sendQuote')}
        </button>
      </div>
    </article>
  )
}

export default function ProMarketplacePage() {
  const router = useRouter()
  const t = useTranslations()
  const [projects, setProjects] = useState<MarketplaceProject[]>([])
  const [access, setAccess] = useState<MarketplaceAccess | null>(null)
  const [loading, setLoading] = useState(true)
  const [quoteProject, setQuoteProject] = useState<MarketplaceProject | null>(null)
  const [submittingProjectId, setSubmittingProjectId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    authenticatedFetch('/api/pro/marketplace')
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setProjects(Array.isArray(data.projects) ? data.projects : [])
        setAccess(data.access ?? null)
      })
      .catch(() => {
        if (!active) return
        setProjects([])
        router.push('/login')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [router])

  async function handleQuoteSubmit(data: QuoteFormData) {
    if (!quoteProject) return
    setSubmittingProjectId(quoteProject.id)
    setError('')
    try {
      await authenticatedFetch(`/api/pro/marketplace/${quoteProject.id}/quote`, {
        method: 'POST',
        body: JSON.stringify({ quote: data }),
      })
      setProjects(prev => prev.filter(project => project.id !== quoteProject.id))
      setQuoteProject(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('proMarketplace.errors.sendQuote'))
    } finally {
      setSubmittingProjectId(null)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proMarketplace.header.kicker')}</p>
            <h1 className="text-5xl font-black leading-[1.05] text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {t('proMarketplace.header.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-base text-gray-500">
              {t('proMarketplace.header.subtitle')}
            </p>
          </div>
          <Link href="/pro/jobs" className="rounded border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50">
            {t('proMarketplace.header.backToJobs')}
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            {error && (
              <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(item => (
                  <div key={item} className="h-56 animate-pulse rounded-lg border border-gray-200 bg-white" />
                ))}
              </div>
            ) : access && !access.eligible ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-2xl font-black text-gray-900" style={dg}>{t('proMarketplace.unavailable.title')}</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                  {access.reason ?? t('proMarketplace.unavailable.body')}
                </p>
                {!access.hasProPlan && (
                  <Link href="/pro/settings" className="mt-5 inline-block rounded bg-sky-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-600">
                    {t('proMarketplace.unavailable.upgrade')}
                  </Link>
                )}
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
                <p className="text-xl font-black text-gray-900" style={dg}>{t('proMarketplace.empty.title')}</p>
                <p className="mt-1 text-sm">{t('proMarketplace.empty.body')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onQuote={setQuoteProject}
                    submitting={submittingProjectId === project.id}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
            <ProUpgradeCta />
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-700">{t('proMarketplace.sidebar.kicker')}</p>
              <h2 className="mb-4 text-2xl font-black leading-none text-gray-900" style={dg}>{t('proMarketplace.sidebar.title')}</h2>
              <ul className="flex flex-col gap-2.5 text-sm text-gray-600">
                {['separateSection', 'noJobUntilAccepted', 'normalWorkflow'].map(item => (
                  <li key={item}>{t(`proMarketplace.sidebar.items.${item}`)}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {quoteProject && (
        <QuoteModal
          categoryName={quoteProject.categoryName}
          onClose={() => setQuoteProject(null)}
          onSubmit={handleQuoteSubmit}
        />
      )}
    </main>
  )
}

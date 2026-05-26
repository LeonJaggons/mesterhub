'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { uploadServiceRequestAttachment } from '@/firebase/storage'
import { AcceptQuoteModal, DeclineQuoteModal } from '@/app/requests/QuoteDecisionModals'
import type { AcceptQuoteInput } from '@/firebase/conversations'
import districtsData from '@/public/districts.json'
import servicesData from '@/public/services.json'
import styles from '../account/account.module.css'
import { dg, districtLabel, formatAnswers, nowTimestamp, timestampMillis, type TimestampLike } from '../requests/shared'
import {
  CATEGORY_QUESTIONS,
  MAX_ATTACHMENT_SIZE,
  MAX_PROJECT_ATTACHMENTS,
  TIMING_OPTIONS,
  URGENCY_OPTIONS,
} from './projectQuestions'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type Translator = ReturnType<typeof useTranslations>

type ProjectDoc = {
  id: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict?: string
  attachmentUrls?: string[]
  invitedProUids?: string[]
  hasAppointment?: boolean
  marketplaceQuotes?: MarketplaceQuote[]
  status?: string
  createdAt: TimestampLike | null
  updatedAt?: TimestampLike | null
}

type MarketplaceQuote = {
  id: string
  projectId: string
  proUid: string
  proName: string
  proCategoryName?: string
  quote: { price: string; timeline: string; notes: string }
  status: 'submitted' | 'accepted' | 'declined' | 'withdrawn'
  requestId?: string
  quotedAt?: TimestampLike | null
  createdAt?: TimestampLike | null
}

type CreateProjectForm = {
  categoryName: string
  customerDistrict: string
  urgency: string
  preferredTiming: string
  projectDetails: string
}

function projectTitle(t: Translator, project: ProjectDoc): string {
  return project.answers.project_details
    || project.answers.task
    || project.answers.issue
    || t('projects.card.titleFallback', { category: translateCategory(t, project.categoryName) })
}

function shortText(value: string, max = 140): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function validAttachment(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
}

function timeAgo(t: Translator, ts: TimestampLike | null): string {
  const millis = timestampMillis(ts)
  if (!millis) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return t('customerRequests.time.justNow')
  if (seconds < 3600) return t('customerRequests.time.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('customerRequests.time.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('customerRequests.time.daysAgo', { count: Math.floor(seconds / 86400) })
}

function optionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function translateQuestionLabel(t: Translator, id: string, fallback: string): string {
  return t(`projects.questions.labels.${id}`, { defaultValue: fallback })
}

function translateQuestionOption(t: Translator, value: string, fallback: string): string {
  return t(`projects.questions.options.${optionKey(value)}`, { defaultValue: fallback })
}

function translatedDetails(t: Translator, answers: Record<string, string>) {
  return formatAnswers(answers)
    .filter(item => item.key !== 'Project Details')
    .map(item => ({
      key: t(`projects.answers.keys.${optionKey(item.key)}`, { defaultValue: item.key }),
      value: t(`projects.answers.values.${optionKey(item.value)}`, { defaultValue: item.value }),
    }))
}

const emptyCreateProjectForm: CreateProjectForm = {
  categoryName: '',
  customerDistrict: '',
  urgency: '',
  preferredTiming: '',
  projectDetails: '',
}

function CreateProjectModal({
  user,
  onClose,
  onCreated,
}: {
  user: User
  onClose: () => void
  onCreated: (project: ProjectDoc) => void
}) {
  const t = useTranslations()
  const [form, setForm] = useState<CreateProjectForm>(emptyCreateProjectForm)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [attachments, setAttachments] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const questions = (CATEGORY_QUESTIONS[form.categoryName] ?? []).filter(q => q.id !== 'urgency')

  function updateForm(field: keyof CreateProjectForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'categoryName') setAnswers({})
    setError(null)
  }

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    setError(null)
    if (files.some(file => !validAttachment(file))) {
      setError(t('projects.create.errors.fileType'))
      return
    }
    if (files.some(file => file.size > MAX_ATTACHMENT_SIZE)) {
      setError(t('projects.create.errors.fileSize'))
      return
    }
    setAttachments(prev => [...prev, ...files].slice(0, MAX_PROJECT_ATTACHMENTS))
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.categoryName || !form.customerDistrict || !form.urgency || !form.projectDetails.trim()) {
      setError(t('projects.create.errors.required'))
      return
    }
    setSubmitting(true)
    try {
      const attachmentUrls = await Promise.all(
        attachments.map(file => uploadServiceRequestAttachment(user.uid, file)),
      )
      const projectAnswers = {
        project_details: form.projectDetails.trim(),
        urgency: form.urgency,
        ...answers,
        ...(form.preferredTiming ? { preferred_timing: form.preferredTiming } : {}),
      }
      const response = await authenticatedFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          categoryName: form.categoryName,
          customerDistrict: form.customerDistrict,
          answers: projectAnswers,
          attachmentUrls,
          customerName: user.displayName ?? '',
          customerEmail: user.email ?? '',
        }),
      })
      const data = (await response.json()) as { id: string }
      onCreated({
        id: data.id,
        categoryName: form.categoryName,
        answers: projectAnswers,
        customerDistrict: form.customerDistrict,
        attachmentUrls,
        invitedProUids: [],
        hasAppointment: false,
        status: 'active',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.create.errors.create'))
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-700">{t('projects.create.kicker')}</p>
            <h2 className="text-3xl font-black leading-none text-gray-900" style={dg}>{t('projects.create.title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              {t('projects.create.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label={t('projects.create.close')}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              {t('projects.create.category')} <span className="text-orange-500">*</span>
            </label>
            <select
              value={form.categoryName}
              onChange={e => updateForm('categoryName', e.target.value)}
              className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
            >
              <option value="">{t('projects.create.selectCategory')}</option>
              {servicesData.categories.map(category => (
                <option key={category.name} value={category.name}>{translateCategory(t, category.name)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                {t('projects.create.district')} <span className="text-orange-500">*</span>
              </label>
              <select
                value={form.customerDistrict}
                onChange={e => updateForm('customerDistrict', e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
              >
                <option value="">{t('projects.create.selectDistrict')}</option>
                {districtsData.districts.map(district => (
                  <option key={district.id} value={district.roman}>{district.roman}. {district.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                {t('projects.create.urgency')} <span className="text-orange-500">*</span>
              </label>
              <select
                value={form.urgency}
                onChange={e => updateForm('urgency', e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
              >
                <option value="">{t('projects.create.selectUrgency')}</option>
                {URGENCY_OPTIONS.map(option => (
                  <option key={option} value={option}>{translateQuestionOption(t, option, option)}</option>
                ))}
              </select>
            </div>
          </div>

          {questions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {questions.map(question => (
                <div key={question.id}>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">{translateQuestionLabel(t, question.id, question.label)}</label>
                  {question.type === 'select' ? (
                    <select
                      value={answers[question.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                      className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
                    >
                      <option value="">{t('projects.create.selectAnswer')}</option>
                      {question.options?.map(option => (
                        <option key={option.value} value={option.value}>{translateQuestionOption(t, option.label, option.label)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[question.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                      placeholder={question.placeholder ? t(`projects.questions.placeholders.${question.id}`, { defaultValue: question.placeholder }) : undefined}
                      className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              {t('projects.create.describeWork')} <span className="text-orange-500">*</span>
            </label>
            <textarea
              value={form.projectDetails}
              onChange={e => updateForm('projectDetails', e.target.value)}
              placeholder={t('projects.create.describePlaceholder')}
              className="w-full min-h-32 resize-y border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">{t('projects.create.preferredTiming')}</label>
            <select
              value={form.preferredTiming}
              onChange={e => updateForm('preferredTiming', e.target.value)}
              className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
            >
              <option value="">{t('projects.create.selectTiming')}</option>
              {TIMING_OPTIONS.map(option => (
                <option key={option} value={option}>{translateQuestionOption(t, option, option)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              {t('projects.create.attachments')} <span className="text-gray-400 font-normal">{t('projects.create.optional')}</span>
            </label>
            <div className="rounded-sm border border-dashed border-gray-300 bg-gray-50 p-4">
              <input
                id="project-attachments"
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleAttachmentChange}
                className="hidden"
              />
              <label htmlFor="project-attachments" className="block cursor-pointer rounded-sm bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 border border-gray-200 hover:bg-slate-50">
                {t('projects.create.addAttachments')}
              </label>
              <p className="mt-2 text-xs text-gray-500">{t('projects.create.uploadLimit', { count: MAX_PROJECT_ATTACHMENTS })}</p>
              {attachments.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {attachments.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm">
                      <span className="truncate text-gray-700">{file.name}</span>
                      <button type="button" onClick={() => removeAttachment(index)} className="shrink-0 border-none bg-transparent text-xs font-bold text-gray-400 hover:text-red-500 cursor-pointer">
                        {t('projects.create.removeAttachment')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 cursor-pointer">
              {t('projects.create.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !form.categoryName || !form.customerDistrict || !form.urgency || !form.projectDetails.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black rounded-xl py-3 text-base transition-colors cursor-pointer disabled:cursor-not-allowed border-none"
              style={dg}
            >
              {submitting ? t('projects.create.creating') : t('projects.create.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  onDelete,
  onAcceptMarketplaceQuote,
  onDeclineMarketplaceQuote,
  isDeleting,
  busyQuoteId,
}: {
  project: ProjectDoc
  onDelete: (project: ProjectDoc) => void
  onAcceptMarketplaceQuote: (project: ProjectDoc, quote: MarketplaceQuote) => void
  onDeclineMarketplaceQuote: (project: ProjectDoc, quote: MarketplaceQuote) => void
  isDeleting: boolean
  busyQuoteId: string | null
}) {
  const t = useTranslations()
  const details = translatedDetails(t, project.answers).slice(0, 4)
  const proCount = project.invitedProUids?.length ?? 0
  const marketplaceQuotes = project.marketplaceQuotes?.filter(quote => quote.status === 'submitted' || quote.status === 'accepted') ?? []

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-slate-700 mb-1">
              {t('projects.card.kicker')}
            </p>
            <h2 className="font-black text-gray-900 text-2xl leading-none" style={dg}>
              {translateCategory(t, project.categoryName)}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {shortText(projectTitle(t, project))}
            </p>
          </div>
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
            {t(proCount === 1 ? 'projects.card.proSentSingular' : 'projects.card.proSentPlural', { count: proCount })}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {project.customerDistrict && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {districtLabel(project.customerDistrict)}
            </span>
          )}
          {project.attachmentUrls?.length ? (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {t(project.attachmentUrls.length === 1 ? 'projects.card.attachmentSingular' : 'projects.card.attachmentPlural', { count: project.attachmentUrls.length })}
            </span>
          ) : null}
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-400">
            {project.updatedAt ? t('projects.card.updated', { time: timeAgo(t, project.updatedAt) }) : timeAgo(t, project.createdAt)}
          </span>
        </div>

        {details.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map(detail => (
              <div key={detail.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="mb-1 text-xs text-gray-400">{detail.key}</p>
                <p className="text-sm font-semibold text-gray-900">{detail.value}</p>
              </div>
            ))}
          </div>
        )}

        {marketplaceQuotes.length > 0 && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">{t('projects.card.marketplace.title')}</p>
              <p className="mt-1 text-sm text-slate-600">
                {t('projects.card.marketplace.body')}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {marketplaceQuotes.map(quote => (
                <div key={quote.id} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{quote.proName || t('projects.card.marketplace.proFallback')}</p>
                      <p className="text-xs text-gray-500">
                        {translateCategory(t, quote.proCategoryName || project.categoryName)}
                        {quote.quotedAt || quote.createdAt ? ` · ${timeAgo(t, quote.quotedAt ?? quote.createdAt ?? null)}` : ''}
                      </p>
                    </div>
                    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold ${
                      quote.status === 'accepted'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}>
                      {quote.status === 'accepted' ? t('projects.card.marketplace.accepted') : t('projects.card.marketplace.badge')}
                    </span>
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-bold text-gray-900">
                      {quote.quote.price}
                      {quote.quote.timeline && <span className="font-normal text-gray-600"> · {quote.quote.timeline}</span>}
                    </p>
                    {quote.quote.notes && <p className="mt-1 text-sm leading-5 text-gray-600">{quote.quote.notes}</p>}
                  </div>
                  {quote.status === 'accepted' && quote.requestId ? (
                    <Link href={`/requests/${quote.requestId}`} className="mt-3 inline-block text-sm font-bold text-slate-700 hover:underline">
                      {t('projects.card.marketplace.viewAccepted')}
                    </Link>
                  ) : (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => onAcceptMarketplaceQuote(project, quote)}
                        disabled={busyQuoteId === quote.id}
                        className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyQuoteId === quote.id ? t('projects.card.marketplace.working') : t('projects.card.marketplace.accept')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclineMarketplaceQuote(project, quote)}
                        disabled={busyQuoteId === quote.id}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t('projects.card.marketplace.decline')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:flex-row">
        <Link
          href={`/instant-results?q=${encodeURIComponent(project.categoryName)}`}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-orange-600"
        >
          {t('projects.card.sendAnother')}
        </Link>
        <Link
          href={`/requests?projectId=${encodeURIComponent(project.id)}`}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {t('projects.card.viewRelated')}
        </Link>
        {!project.hasAppointment && (
          <button
            type="button"
            onClick={() => onDelete(project)}
            disabled={isDeleting}
            className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isDeleting ? t('projects.card.deleting') : t('projects.card.delete')}
          </button>
        )}
      </div>
    </article>
  )
}

export default function ProjectsPage() {
  const t = useTranslations()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [acceptingQuote, setAcceptingQuote] = useState<{ project: ProjectDoc; quote: MarketplaceQuote } | null>(null)
  const [decliningQuote, setDecliningQuote] = useState<{ project: ProjectDoc; quote: MarketplaceQuote } | null>(null)
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthChange(async user => {
      if (!user) {
        router.replace('/login?next=/projects')
        return
      }
      setUser(user)

      try {
        const response = await authenticatedFetch('/api/projects')
        const data = (await response.json()) as { projects?: ProjectDoc[] }
        const activeProjects = (data.projects ?? [])
          .filter(project => project.status === 'active' && project.categoryName)
          .sort((a, b) => {
            const aTime = timestampMillis(a.updatedAt) ?? timestampMillis(a.createdAt) ?? 0
            const bTime = timestampMillis(b.updatedAt) ?? timestampMillis(b.createdAt) ?? 0
            return bTime - aTime
          })

        setProjects(activeProjects)
      } catch {
        setProjects([])
      } finally {
        setLoading(false)
      }
    })
  }, [router])

  function handleProjectCreated(project: ProjectDoc) {
    setProjects(prev => [project, ...prev])
  }

  async function handleDeleteProject(project: ProjectDoc) {
    const confirmed = window.confirm(
      t('projects.delete.confirm'),
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeletingProjectId(project.id)
    try {
      await authenticatedFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(item => item.id !== project.id))
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('projects.delete.error'))
    } finally {
      setDeletingProjectId(null)
    }
  }

  async function handleAcceptMarketplaceQuote(input: AcceptQuoteInput) {
    if (!acceptingQuote) return
    const { project, quote } = acceptingQuote
    setBusyQuoteId(quote.id)
    setDeleteError(null)
    try {
      const res = await authenticatedFetch(`/api/projects/${project.id}/marketplace-quotes/${quote.id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ input }),
      })
      const data = await res.json() as { requestId?: string }
      setProjects(prev => prev.map(item => item.id === project.id
        ? {
            ...item,
            marketplaceQuotes: item.marketplaceQuotes?.map(existing => existing.id === quote.id
              ? { ...existing, status: 'accepted', requestId: data.requestId }
              : existing),
            invitedProUids: [...new Set([...(item.invitedProUids ?? []), quote.proUid])],
            updatedAt: nowTimestamp(),
          }
        : item))
      setAcceptingQuote(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('projects.errors.acceptQuote'))
    } finally {
      setBusyQuoteId(null)
    }
  }

  async function handleDeclineMarketplaceQuote(reason: string) {
    if (!decliningQuote) return
    const { project, quote } = decliningQuote
    setBusyQuoteId(quote.id)
    setDeleteError(null)
    try {
      await authenticatedFetch(`/api/projects/${project.id}/marketplace-quotes/${quote.id}/decline`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      setProjects(prev => prev.map(item => item.id === project.id
        ? {
            ...item,
            marketplaceQuotes: item.marketplaceQuotes?.filter(existing => existing.id !== quote.id),
            updatedAt: nowTimestamp(),
          }
        : item))
      setDecliningQuote(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('projects.errors.declineQuote'))
    } finally {
      setBusyQuoteId(null)
    }
  }

  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className={styles.title}>{t('projects.header.title')}</h1>
            <p className={styles.subtitle}>{t('projects.header.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 cursor-pointer border-none"
          >
            {t('projects.header.create')}
          </button>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-56 bg-white rounded-2xl border border-gray-200" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>
            <p className={styles.emptyTitle}>{t('projects.empty.title')}</p>
            <p>{t('projects.empty.body')}</p>
            <button type="button" onClick={() => setCreateOpen(true)} className={styles.linkBtn}>
              {t('projects.empty.cta')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {deleteError}
              </div>
            )}
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={handleDeleteProject}
                onAcceptMarketplaceQuote={(project, quote) => setAcceptingQuote({ project, quote })}
                onDeclineMarketplaceQuote={(project, quote) => setDecliningQuote({ project, quote })}
                isDeleting={deletingProjectId === project.id}
                busyQuoteId={busyQuoteId}
              />
            ))}
          </div>
        )}
      </div>
      {createOpen && user && (
        <CreateProjectModal
          user={user}
          onClose={() => setCreateOpen(false)}
          onCreated={handleProjectCreated}
        />
      )}
      {acceptingQuote && (
        <AcceptQuoteModal
          proName={acceptingQuote.quote.proName || t('projects.card.marketplace.thisPro')}
          onClose={() => setAcceptingQuote(null)}
          onSubmit={handleAcceptMarketplaceQuote}
        />
      )}
      {decliningQuote && (
        <DeclineQuoteModal
          proName={decliningQuote.quote.proName || t('projects.card.marketplace.thisPro')}
          onClose={() => setDecliningQuote(null)}
          onConfirm={handleDeclineMarketplaceQuote}
        />
      )}
    </main>
  )
}

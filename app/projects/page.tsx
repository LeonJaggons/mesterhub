'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { uploadServiceRequestAttachment } from '@/firebase/storage'
import districtsData from '@/public/districts.json'
import servicesData from '@/public/services.json'
import styles from '../account/account.module.css'
import { dg, districtLabel, formatAnswers, nowTimestamp, timeAgo, timestampMillis, type TimestampLike } from '../requests/shared'
import {
  CATEGORY_QUESTIONS,
  MAX_ATTACHMENT_SIZE,
  MAX_PROJECT_ATTACHMENTS,
  TIMING_OPTIONS,
  URGENCY_OPTIONS,
} from './projectQuestions'

type ProjectDoc = {
  id: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict?: string
  attachmentUrls?: string[]
  invitedProUids?: string[]
  hasAppointment?: boolean
  status?: string
  createdAt: TimestampLike | null
  updatedAt?: TimestampLike | null
}

type CreateProjectForm = {
  categoryName: string
  customerDistrict: string
  urgency: string
  preferredTiming: string
  projectDetails: string
}

function projectTitle(project: ProjectDoc): string {
  return project.answers.project_details
    || project.answers.task
    || project.answers.issue
    || `${project.categoryName} project`
}

function shortText(value: string, max = 140): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function validAttachment(file: File): boolean {
  return file.type.startsWith('image/') || file.type === 'application/pdf'
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
      setError('Upload photos or PDF files only.')
      return
    }
    if (files.some(file => file.size > MAX_ATTACHMENT_SIZE)) {
      setError('Each attachment must be under 10 MB.')
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
      setError('Category, district, urgency, and project details are required.')
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
      setError(err instanceof Error ? err.message : 'Could not create project.')
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
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-orange-500">New project</p>
            <h2 className="text-3xl font-black leading-none text-gray-900" style={dg}>Describe your project</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">
              Use the same estimate request fields now, then send this project to one or more pros later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-none bg-transparent p-1 text-2xl leading-none text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              Category <span className="text-orange-500">*</span>
            </label>
            <select
              value={form.categoryName}
              onChange={e => updateForm('categoryName', e.target.value)}
              className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
            >
              <option value="">Select category</option>
              {servicesData.categories.map(category => (
                <option key={category.name} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                Your district <span className="text-orange-500">*</span>
              </label>
              <select
                value={form.customerDistrict}
                onChange={e => updateForm('customerDistrict', e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
              >
                <option value="">Select district</option>
                {districtsData.districts.map(district => (
                  <option key={district.id} value={district.roman}>{district.roman}. {district.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                Urgency <span className="text-orange-500">*</span>
              </label>
              <select
                value={form.urgency}
                onChange={e => updateForm('urgency', e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
              >
                <option value="">Select urgency</option>
                {URGENCY_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {questions.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {questions.map(question => (
                <div key={question.id}>
                  <label className="block text-sm font-bold text-gray-800 mb-1.5">{question.label}</label>
                  {question.type === 'select' ? (
                    <select
                      value={answers[question.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                      className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
                    >
                      <option value="">Select answer</option>
                      {question.options?.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={answers[question.id] ?? ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                      placeholder={question.placeholder}
                      className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              Describe the work <span className="text-orange-500">*</span>
            </label>
            <textarea
              value={form.projectDetails}
              onChange={e => updateForm('projectDetails', e.target.value)}
              placeholder="Tell pros what needs doing, what problem you are seeing, measurements, photos you can share, and anything unusual about the job."
              className="w-full min-h-32 resize-y border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-orange-400 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">Preferred timing</label>
            <select
              value={form.preferredTiming}
              onChange={e => updateForm('preferredTiming', e.target.value)}
              className="w-full appearance-none border border-gray-200 rounded-sm px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 transition-colors"
            >
              <option value="">Select timing</option>
              {TIMING_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-1.5">
              Photos or attachments <span className="text-gray-400 font-normal">(optional)</span>
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
              <label htmlFor="project-attachments" className="block cursor-pointer rounded-sm bg-white px-4 py-3 text-center text-sm font-bold text-orange-600 border border-gray-200 hover:bg-orange-50">
                Add photos or PDFs
              </label>
              <p className="mt-2 text-xs text-gray-500">Upload up to {MAX_PROJECT_ATTACHMENTS} files.</p>
              {attachments.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2">
                  {attachments.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm">
                      <span className="truncate text-gray-700">{file.name}</span>
                      <button type="button" onClick={() => removeAttachment(index)} className="shrink-0 border-none bg-transparent text-xs font-bold text-gray-400 hover:text-red-500 cursor-pointer">
                        Remove
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.categoryName || !form.customerDistrict || !form.urgency || !form.projectDetails.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black rounded-xl py-3 text-base transition-colors cursor-pointer disabled:cursor-not-allowed border-none"
              style={dg}
            >
              {submitting ? 'Creating...' : 'Create project'}
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
  isDeleting,
}: {
  project: ProjectDoc
  onDelete: (project: ProjectDoc) => void
  isDeleting: boolean
}) {
  const details = formatAnswers(project.answers).filter(item => item.key !== 'Project Details').slice(0, 4)
  const proCount = project.invitedProUids?.length ?? 0

  return (
    <article className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">
              Active project
            </p>
            <h2 className="font-black text-gray-900 text-2xl leading-none" style={dg}>
              {project.categoryName}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {shortText(projectTitle(project))}
            </p>
          </div>
          <span className="w-fit rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
            {proCount} pro{proCount === 1 ? '' : 's'} sent
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
              {project.attachmentUrls.length} attachment{project.attachmentUrls.length === 1 ? '' : 's'}
            </span>
          ) : null}
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-400">
            {project.updatedAt ? `Updated ${timeAgo(project.updatedAt)}` : timeAgo(project.createdAt)}
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
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:flex-row">
        <Link
          href={`/instant-results?q=${encodeURIComponent(project.categoryName)}`}
          className="rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-orange-600"
        >
          Send to another pro
        </Link>
        <Link
          href={`/requests?projectId=${encodeURIComponent(project.id)}`}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          View related requests
        </Link>
        {!project.hasAppointment && (
          <button
            type="button"
            onClick={() => onDelete(project)}
            disabled={isDeleting}
            className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Delete project'}
          </button>
        )}
      </div>
    </article>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
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
      'Delete this project? Related requests will be hidden from your account, and any active requests will be cancelled. Projects with completed jobs or appointments cannot be deleted.',
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeletingProjectId(project.id)
    try {
      await authenticatedFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(item => item.id !== project.id))
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete project.')
    } finally {
      setDeletingProjectId(null)
    }
  }

  return (
    <main className="bg-gray-50 min-h-screen flex-1">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className={styles.title}>My projects</h1>
            <p className={styles.subtitle}>Reusable job briefs you can send to more pros without filling out the form again.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 cursor-pointer border-none"
          >
            Create project
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
            <p className={styles.emptyTitle}>No active projects</p>
            <p>Projects appear here after you request an estimate from a pro.</p>
            <button type="button" onClick={() => setCreateOpen(true)} className={styles.linkBtn}>
              Create project
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
                isDeleting={deletingProjectId === project.id}
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
    </main>
  )
}

'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdClose, MdOutlineUploadFile } from 'react-icons/md'
import { save, stageFile, type PastProject } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const MAX_DESCRIPTION = 200

type UploadState = 'idle' | 'uploading' | 'done' | 'error'
type ImageSlot = 'before' | 'after'

export default function WorkPhotosPage() {
  const router = useRouter()
  const beforeInputRef = useRef<HTMLInputElement>(null)
  const afterInputRef = useRef<HTMLInputElement>(null)
  const [projects, setProjects] = useState<PastProject[]>([])
  const [form, setForm] = useState({
    jobType: '',
    location: '',
    duration: '',
    year: '',
    description: '',
    beforeUrl: '',
    afterUrl: '',
  })
  const [previews, setPreviews] = useState({ before: '', after: '' })
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<ImageSlot, File>>>({})
  const [uploadState, setUploadState] = useState<Record<ImageSlot, UploadState>>({ before: 'idle', after: 'idle' })

  async function handleImageChange(slot: ImageSlot, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviews(prev => ({ ...prev, [slot]: URL.createObjectURL(file) }))
    setSelectedFiles(prev => ({ ...prev, [slot]: file }))
    setUploadState(prev => ({ ...prev, [slot]: 'done' }))
  }

  function clearImage(slot: ImageSlot) {
    setPreviews(prev => ({ ...prev, [slot]: '' }))
    setSelectedFiles(prev => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
    setForm(prev => ({ ...prev, [`${slot}Url`]: '' }))
    setUploadState(prev => ({ ...prev, [slot]: 'idle' }))
  }

  function addProject() {
    const id = String(Date.now())
    const nextProject: PastProject = {
      id,
      jobType: form.jobType.trim(),
      location: form.location.trim(),
      duration: form.duration.trim(),
      year: form.year.trim(),
      description: form.description.trim(),
      ...(form.beforeUrl ? { beforeUrl: form.beforeUrl } : {}),
      ...(form.afterUrl ? { afterUrl: form.afterUrl } : {}),
    }
    if (selectedFiles.before) stageFile(`project:${id}:before`, selectedFiles.before)
    if (selectedFiles.after) stageFile(`project:${id}:after`, selectedFiles.after)
    const nextProjects = [...projects, nextProject]
    setProjects(nextProjects)
    save({ pastProjects: nextProjects })
    setForm({ jobType: '', location: '', duration: '', year: '', description: '', beforeUrl: '', afterUrl: '' })
    setPreviews({ before: '', after: '' })
    setSelectedFiles({})
    setUploadState({ before: 'idle', after: 'idle' })
  }

  function removeProject(id: string) {
    const nextProjects = projects.filter(project => project.id !== id)
    setProjects(nextProjects)
    save({ pastProjects: nextProjects })
  }

  function continueToFaq() {
    save({ pastProjects: projects })
    router.push('/pro/signup/faq')
  }

  const uploading = uploadState.before === 'uploading' || uploadState.after === 'uploading'
  const canAddProject = form.jobType.trim() && form.location.trim() && form.duration.trim() &&
    form.year.trim() && form.description.trim() && !uploading

  return (
    <div className={styles.stepPageWide}>
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Add past projects</h1>
      <p className={styles.stepSubtitle}>
        Turn sample work into project cards. Add a before and after photo if it helps, plus the basic details customers care about.
      </p>

      {projects.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {projects.map(project => (
            <div key={project.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <p style={{ fontWeight: 800, color: '#111827', marginBottom: '0.25rem' }}>{project.jobType}</p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  {project.location} · {project.duration} · {project.year}
                </p>
                <p style={{ fontSize: '0.875rem', color: '#374151' }}>{project.description}</p>
              </div>
              <button
                type="button"
                onClick={() => removeProject(project.id)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', alignSelf: 'flex-start' }}
                aria-label="Remove project"
              >
                <MdClose size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.previewLayout}>
        <div>
          <div className={styles.field}>
            <label className={styles.label}>Job type</label>
            <input
              className={styles.input}
              value={form.jobType}
              onChange={e => setForm(prev => ({ ...prev, jobType: e.target.value }))}
              placeholder="e.g. Bathroom renovation, Deep cleaning, AC installation"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Location</label>
            <input
              className={styles.input}
              value={form.location}
              onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g. District V, Budapest"
            />
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Duration</label>
              <input
                className={styles.input}
                value={form.duration}
                onChange={e => setForm(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="e.g. 2 days"
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Year</label>
              <input
                className={styles.input}
                inputMode="numeric"
                maxLength={4}
                value={form.year}
                onChange={e => setForm(prev => ({ ...prev, year: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="e.g. 2025"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Short description <span className={styles.labelHint}>{form.description.length}/{MAX_DESCRIPTION}</span>
            </label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value.slice(0, MAX_DESCRIPTION) }))}
              placeholder="Briefly explain the job, result, or customer need."
            />
          </div>

          <button className={styles.continueBtn} style={dg} disabled={!canAddProject} onClick={addProject}>
            {uploading ? 'Uploading…' : 'Add project'}
          </button>
          <button className={styles.secondaryBtn} style={dg} disabled={uploading} onClick={continueToFaq}>
            {projects.length > 0 ? 'Continue' : 'Skip for now'}
          </button>
        </div>

        <div>
          {(['before', 'after'] as const).map(slot => {
            const inputRef = slot === 'before' ? beforeInputRef : afterInputRef
            const state = uploadState[slot]
            const preview = previews[slot]
            return (
              <div className={styles.field} key={slot}>
                <label className={styles.label}>{slot === 'before' ? 'Before photo' : 'After photo'} <span className={styles.labelHint}>optional</span></label>
                {preview ? (
                  <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <img src={preview} alt={`${slot} project`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => clearImage(slot)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label={`Remove ${slot} photo`}
                    >
                      <MdClose size={15} color="white" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={`${styles.uploadArea} ${state === 'uploading' ? styles.uploadAreaActive : ''}`}
                    style={{ cursor: state === 'uploading' ? 'wait' : 'pointer', padding: '1.5rem' }}
                    onClick={() => state !== 'uploading' && inputRef.current?.click()}
                  >
                    <MdOutlineUploadFile size={26} color="#f97316" style={{ margin: '0 auto 0.5rem' }} />
                    <p className={styles.uploadTitle}>{state === 'uploading' ? 'Uploading…' : `Upload ${slot}`}</p>
                    {state === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>Upload failed — try again</p>}
                    <p className={styles.uploadHint}>JPG or PNG</p>
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => handleImageChange(slot, e)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

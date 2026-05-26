'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdClose, MdOutlineUploadFile } from 'react-icons/md'
import { useTranslations } from '@/lib/i18n/client'
import { save, stageFile, type PastProject } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
const MAX_DESCRIPTION = 200

type UploadState = 'idle' | 'uploading' | 'done' | 'error'
type ImageSlot = 'before' | 'after'

export default function WorkPhotosPage() {
  const t = useTranslations()
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
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.work.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.work.subtitle')}
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
                aria-label={t('proSignup.work.removeProject')}
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
            <label className={styles.label}>{t('proSignup.work.jobType')}</label>
            <input
              className={styles.input}
              value={form.jobType}
              onChange={e => setForm(prev => ({ ...prev, jobType: e.target.value }))}
              placeholder={t('proSignup.work.jobTypePlaceholder')}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('proSignup.work.location')}</label>
            <input
              className={styles.input}
              value={form.location}
              onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
              placeholder={t('proSignup.work.locationPlaceholder')}
            />
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>{t('proSignup.work.duration')}</label>
              <input
                className={styles.input}
                value={form.duration}
                onChange={e => setForm(prev => ({ ...prev, duration: e.target.value }))}
                placeholder={t('proSignup.work.durationPlaceholder')}
              />
            </div>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>{t('proSignup.work.year')}</label>
              <input
                className={styles.input}
                inputMode="numeric"
                maxLength={4}
                value={form.year}
                onChange={e => setForm(prev => ({ ...prev, year: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder={t('proSignup.work.yearPlaceholder')}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              {t('proSignup.work.description')} <span className={styles.labelHint}>{form.description.length}/{MAX_DESCRIPTION}</span>
            </label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value.slice(0, MAX_DESCRIPTION) }))}
              placeholder={t('proSignup.work.descriptionPlaceholder')}
            />
          </div>

          <button className={styles.continueBtn} style={dg} disabled={!canAddProject} onClick={addProject}>
            {uploading ? t('proSignup.common.uploading') : t('proSignup.work.addProject')}
          </button>
          <button className={styles.secondaryBtn} style={dg} disabled={uploading} onClick={continueToFaq}>
            {projects.length > 0 ? t('proSignup.common.continue') : t('proSignup.common.skipForNow')}
          </button>
        </div>

        <div>
          {(['before', 'after'] as const).map(slot => {
            const inputRef = slot === 'before' ? beforeInputRef : afterInputRef
            const state = uploadState[slot]
            const preview = previews[slot]
            const slotLabel = slot === 'before' ? t('proSignup.work.beforeSlot') : t('proSignup.work.afterSlot')
            return (
              <div className={styles.field} key={slot}>
                <label className={styles.label}>{slot === 'before' ? t('proSignup.work.beforePhoto') : t('proSignup.work.afterPhoto')} <span className={styles.labelHint}>{t('proSignup.common.optional')}</span></label>
                {preview ? (
                  <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <img src={preview} alt={slot === 'before' ? t('proSignup.work.beforeAlt') : t('proSignup.work.afterAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => clearImage(slot)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label={t('proSignup.work.removePhoto', { slot: slotLabel })}
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
                    <p className={styles.uploadTitle}>{state === 'uploading' ? t('proSignup.common.uploading') : t('proSignup.work.uploadSlot', { slot: slotLabel })}</p>
                    {state === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>{t('proSignup.common.uploadFailedRetry')}</p>}
                    <p className={styles.uploadHint}>{t('proSignup.common.jpgPng')}</p>
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

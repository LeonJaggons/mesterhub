'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdOutlineUploadFile, MdOutlineCameraAlt, MdCheckCircle } from 'react-icons/md'
import { useTranslations } from '@/lib/i18n/client'
import { compressImageFile } from '@/lib/imageCompression'
import { save, stageFile } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export default function VerificationPage() {
  const t = useTranslations()
  const router = useRouter()

  const idInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)

  const [idState, setIdState] = useState<UploadState>('idle')
  const [idFileName, setIdFileName] = useState<string | null>(null)

  const [selfieState, setSelfieState] = useState<UploadState>('idle')
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)

  async function handleIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIdState('uploading')
    try {
      const uploadFile = file.type.startsWith('image/') ? await compressImageFile(file) : file
      setIdFileName(uploadFile.name)
      stageFile('idDocument', uploadFile)
      save({ idDocumentUrl: '' })
      setIdState('done')
    } catch {
      setIdState('error')
    }
  }

  async function handleSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelfieState('uploading')
    try {
      const compressed = await compressImageFile(file)
      setSelfiePreview(URL.createObjectURL(compressed))
      stageFile('selfie', compressed)
      save({ selfieUrl: '' })
      setSelfieState('done')
    } catch {
      setSelfieState('error')
    }
  }

  const canContinue = idState === 'done' && selfieState === 'done'

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.verification.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.verification.subtitle')}
      </p>

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>{t('proSignup.verification.secureTitle')}</p>
        {t('proSignup.verification.secureText')}
      </div>

      {/* ID upload */}
      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.verification.id')}</label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          {t('proSignup.verification.idHint')}
        </p>

        {idState !== 'done' ? (
          <div
            className={`${styles.uploadArea} ${idState === 'uploading' ? styles.uploadAreaActive : ''}`}
            style={{ cursor: idState === 'uploading' ? 'wait' : 'pointer' }}
            onClick={() => idState !== 'uploading' && idInputRef.current?.click()}
          >
            <MdOutlineUploadFile size={32} color="#f97316" style={{ margin: '0 auto 0.5rem' }} />
            {idState === 'uploading' && <p className={styles.uploadTitle}>{t('proSignup.common.uploading')}</p>}
            {idState === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>{t('proSignup.common.uploadFailedClickRetry')}</p>}
            {idState === 'idle' && (
              <>
                <p className={styles.uploadTitle}>{t('proSignup.verification.uploadId')}</p>
                <p className={styles.uploadHint}>{t('proSignup.common.documentHint')}</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem' }}>
            <MdCheckCircle size={22} color="#16a34a" />
            <div>
              <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: '0.9375rem' }}>{t('proSignup.verification.idUploaded')}</p>
              {idFileName && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8125rem' }}>{idFileName}</p>}
            </div>
            <button onClick={() => { setIdState('idle'); setIdFileName(null) }}
              style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
              {t('proSignup.common.replace')}
            </button>
          </div>
        )}
        <input ref={idInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleIdChange} />
      </div>

      {/* Selfie */}
      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.verification.selfie')}</label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          {t('proSignup.verification.selfieHint')}
        </p>

        {selfieState !== 'done' ? (
          <div
            className={`${styles.uploadArea} ${selfieState === 'uploading' ? styles.uploadAreaActive : ''}`}
            style={{ cursor: selfieState === 'uploading' ? 'wait' : 'pointer' }}
            onClick={() => selfieState !== 'uploading' && selfieInputRef.current?.click()}
          >
            {selfiePreview
              ? <img src={selfiePreview} alt={t('proSignup.verification.selfieAlt')} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 0.5rem' }} />
              : <MdOutlineCameraAlt size={32} color="#f97316" style={{ margin: '0 auto 0.5rem' }} />}
            {selfieState === 'uploading' && <p className={styles.uploadTitle}>{t('proSignup.common.uploading')}</p>}
            {selfieState === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>{t('proSignup.common.uploadFailedClickRetry')}</p>}
            {selfieState === 'idle' && (
              <>
                <p className={styles.uploadTitle}>{selfiePreview ? t('proSignup.common.uploading') : t('proSignup.verification.takeSelfie')}</p>
                <p className={styles.uploadHint}>{t('proSignup.verification.selfieUploadHint')}</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem' }}>
            {selfiePreview && <img src={selfiePreview} alt={t('proSignup.verification.selfieAlt')} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />}
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: '0.9375rem' }}>{t('proSignup.verification.selfieUploaded')}</p>
            </div>
            <MdCheckCircle size={22} color="#16a34a" />
          </div>
        )}

        {/* capture="user" triggers front camera on mobile; falls back to file picker on desktop */}
        <input
          ref={selfieInputRef} type="file" accept="image/*"
          capture={"user" as unknown as boolean}
          style={{ display: 'none' }}
          onChange={handleSelfieChange}
        />
      </div>

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={!canContinue && idState !== 'uploading' && selfieState !== 'uploading'}
        onClick={() => router.push('/pro/signup/credentials')}
      >
        {(idState === 'uploading' || selfieState === 'uploading') ? t('proSignup.common.uploading') : t('proSignup.verification.submit')}
      </button>

      <button className={styles.secondaryBtn} style={dg} onClick={() => router.push('/pro/signup/credentials')}>
        {t('proSignup.verification.skip')}
      </button>
    </div>
  )
}

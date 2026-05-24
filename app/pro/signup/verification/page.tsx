'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdOutlineUploadFile, MdOutlineCameraAlt, MdCheckCircle } from 'react-icons/md'
import { auth } from '@/firebase/index'
import { uploadProFile } from '@/firebase/storage'
import { save } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type UploadState = 'idle' | 'uploading' | 'done' | 'error'

export default function VerificationPage() {
  const router = useRouter()
  const uid = auth.currentUser?.uid

  const idInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)

  const [idState, setIdState] = useState<UploadState>('idle')
  const [idFileName, setIdFileName] = useState<string | null>(null)

  const [selfieState, setSelfieState] = useState<UploadState>('idle')
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)

  async function handleIdChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uid) return
    setIdFileName(file.name)
    setIdState('uploading')
    try {
      const url = await uploadProFile(uid, 'id-document', file)
      save({ idDocumentUrl: url })
      setIdState('done')
    } catch {
      setIdState('error')
    }
  }

  async function handleSelfieChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uid) return
    setSelfiePreview(URL.createObjectURL(file))
    setSelfieState('uploading')
    try {
      const url = await uploadProFile(uid, 'selfie', file)
      save({ selfieUrl: url })
      setSelfieState('done')
    } catch {
      setSelfieState('error')
    }
  }

  const canContinue = idState === 'done' && selfieState === 'done'

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Verify your identity</h1>
      <p className={styles.stepSubtitle}>
        Every professional on Mestermind is identity-verified before going live. Checks are typically completed within a few hours.
      </p>

      <div className={styles.infoBox}>
        <p className={styles.infoBoxTitle}>Your data is encrypted and secure</p>
        Documents are uploaded to owner-restricted storage and reviewed before a profile can go live.
      </div>

      {/* ID upload */}
      <div className={styles.field}>
        <label className={styles.label}>Government-issued ID</label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          Személyi igazolvány, útlevél, or driving licence. All four corners must be visible.
        </p>

        {idState !== 'done' ? (
          <div
            className={`${styles.uploadArea} ${idState === 'uploading' ? styles.uploadAreaActive : ''}`}
            style={{ cursor: idState === 'uploading' ? 'wait' : 'pointer' }}
            onClick={() => idState !== 'uploading' && idInputRef.current?.click()}
          >
            <MdOutlineUploadFile size={32} color="#f97316" style={{ margin: '0 auto 0.5rem' }} />
            {idState === 'uploading' && <p className={styles.uploadTitle}>Uploading…</p>}
            {idState === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>Upload failed — click to retry</p>}
            {idState === 'idle' && (
              <>
                <p className={styles.uploadTitle}>Upload front of ID</p>
                <p className={styles.uploadHint}>JPG, PNG or PDF · max 10 MB</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem' }}>
            <MdCheckCircle size={22} color="#16a34a" />
            <div>
              <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: '0.9375rem' }}>ID uploaded</p>
              {idFileName && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8125rem' }}>{idFileName}</p>}
            </div>
            <button onClick={() => { setIdState('idle'); setIdFileName(null) }}
              style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
              Replace
            </button>
          </div>
        )}
        <input ref={idInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleIdChange} />
      </div>

      {/* Selfie */}
      <div className={styles.field}>
        <label className={styles.label}>Selfie match</label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
          Take a selfie or upload a photo of your face so we can confirm the ID belongs to you.
        </p>

        {selfieState !== 'done' ? (
          <div
            className={`${styles.uploadArea} ${selfieState === 'uploading' ? styles.uploadAreaActive : ''}`}
            style={{ cursor: selfieState === 'uploading' ? 'wait' : 'pointer' }}
            onClick={() => selfieState !== 'uploading' && selfieInputRef.current?.click()}
          >
            {selfiePreview
              ? <img src={selfiePreview} alt="selfie" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 0.5rem' }} />
              : <MdOutlineCameraAlt size={32} color="#f97316" style={{ margin: '0 auto 0.5rem' }} />}
            {selfieState === 'uploading' && <p className={styles.uploadTitle}>Uploading…</p>}
            {selfieState === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>Upload failed — click to retry</p>}
            {selfieState === 'idle' && (
              <>
                <p className={styles.uploadTitle}>{selfiePreview ? 'Uploading…' : 'Take or upload a selfie'}</p>
                <p className={styles.uploadHint}>Uses camera on mobile · good lighting, neutral background</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem' }}>
            {selfiePreview && <img src={selfiePreview} alt="selfie" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />}
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: '0.9375rem' }}>Selfie uploaded</p>
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
        {(idState === 'uploading' || selfieState === 'uploading') ? 'Uploading…' : 'Submit for verification'}
      </button>

      <button className={styles.secondaryBtn} style={dg} onClick={() => router.push('/pro/signup/credentials')}>
        Skip for now — finish later
      </button>
    </div>
  )
}

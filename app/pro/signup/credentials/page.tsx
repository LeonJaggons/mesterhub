'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdCheckCircle, MdOutlineUploadFile } from 'react-icons/md'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'
import { compressImageFile } from '@/lib/imageCompression'
import { load, save, stageFile } from '../store'
import styles from '../signup.module.css'
import { dg } from '@/lib/ui'

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

function UploadBox({ state, fileName, inputRef, onRetry, copy }: {
  state: UploadState
  fileName: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onRetry: () => void
  copy: {
    uploaded: string
    replace: string
    uploading: string
    uploadFailed: string
    uploadDocument: string
    documentHint: string
  }
}) {
  if (state === 'done') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem' }}>
        <MdCheckCircle size={22} color="#16a34a" />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: '0.9375rem' }}>{copy.uploaded}</p>
          {fileName && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8125rem' }}>{fileName}</p>}
        </div>
        <button onClick={onRetry} style={{ fontSize: '0.8125rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>{copy.replace}</button>
      </div>
    )
  }
  return (
    <div
      className={`${styles.uploadArea} ${state === 'uploading' ? styles.uploadAreaActive : ''}`}
      style={{ cursor: state === 'uploading' ? 'wait' : 'pointer' }}
      onClick={() => state !== 'uploading' && inputRef.current?.click()}
    >
      <MdOutlineUploadFile size={28} color="#0ea5e9" style={{ margin: '0 auto 0.5rem' }} />
      {state === 'uploading' && <p className={styles.uploadTitle}>{copy.uploading}</p>}
      {state === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>{copy.uploadFailed}</p>}
      {state === 'idle' && (
        <>
          <p className={styles.uploadTitle}>{copy.uploadDocument}</p>
          <p className={styles.uploadHint}>{copy.documentHint}</p>
        </>
      )}
    </div>
  )
}

export default function CredentialsPage() {
  const t = useTranslations()
  const router = useRouter()
  const data = load()
  const isRegulated = data.regulated ?? false
  const needsInsurance = data.insuranceRequired ?? false

  const certInputRef = useRef<HTMLInputElement>(null)
  const insuranceInputRef = useRef<HTMLInputElement>(null)

  const [licenceNumber, setLicenceNumber] = useState(data.licenceNumber ?? '')
  const [certState, setCertState] = useState<UploadState>('idle')
  const [certFileName, setCertFileName] = useState<string | null>(null)
  const [insuranceState, setInsuranceState] = useState<UploadState>('idle')
  const [insuranceFileName, setInsuranceFileName] = useState<string | null>(null)
  const uploadCopy = {
    uploaded: t('proSignup.common.uploaded'),
    replace: t('proSignup.common.replace'),
    uploading: t('proSignup.common.uploading'),
    uploadFailed: t('proSignup.common.uploadFailedClickRetry'),
    uploadDocument: t('proSignup.credentials.certificate'),
    documentHint: t('proSignup.common.documentHint'),
  }

  async function handleCertChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertState('uploading')
    try {
      const uploadFile = file.type.startsWith('image/') ? await compressImageFile(file) : file
      setCertFileName(uploadFile.name)
      stageFile('certificate', uploadFile)
      save({ certificateUrl: '' })
      setCertState('done')
    } catch {
      setCertState('error')
    }
  }

  async function handleInsuranceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setInsuranceState('uploading')
    try {
      const uploadFile = file.type.startsWith('image/') ? await compressImageFile(file) : file
      setInsuranceFileName(uploadFile.name)
      stageFile('insurance', uploadFile)
      save({ insuranceUrl: '' })
      setInsuranceState('done')
    } catch {
      setInsuranceState('error')
    }
  }

  if (!isRegulated) {
    return (
      <div className={styles.stepPage}>
        <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
        <h1 className={styles.stepTitle} style={dg}>{t('proSignup.credentials.title')}</h1>
        <p className={styles.stepSubtitle}>
          {t('proSignup.credentials.unregulated', { category: translateCategory(t, data.categoryName ?? '') })}
        </p>
        <button className={styles.continueBtn} style={dg} onClick={() => router.push('/pro/signup/background')}>
          {t('proSignup.common.continue')}
        </button>
      </div>
    )
  }

  const canContinue = certState === 'done' && (!needsInsurance || insuranceState === 'done')

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>{t('proSignup.common.back')}</button>
      <h1 className={styles.stepTitle} style={dg}>{t('proSignup.credentials.title')}</h1>
      <p className={styles.stepSubtitle}>
        {t('proSignup.credentials.regulated', { category: translateCategory(t, data.categoryName ?? '') })}
      </p>

      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.credentials.licence')} <span className={styles.labelHint}>{t('proSignup.credentials.licenceHint')}</span></label>
        <input className={styles.input} placeholder="e.g. HU-OKKJ-12345" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('proSignup.credentials.certificate')}</label>
        <UploadBox state={certState} fileName={certFileName} inputRef={certInputRef}
          onRetry={() => { setCertState('idle'); setCertFileName(null) }} copy={uploadCopy} />
        <input ref={certInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleCertChange} />
      </div>

      {needsInsurance && (
        <div className={styles.field}>
          <label className={styles.label}>{t('proSignup.credentials.insurance')}</label>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            {t('proSignup.credentials.insuranceHint')}
          </p>
          <UploadBox state={insuranceState} fileName={insuranceFileName} inputRef={insuranceInputRef}
            onRetry={() => { setInsuranceState('idle'); setInsuranceFileName(null) }} copy={{ ...uploadCopy, uploadDocument: t('proSignup.credentials.insurance') }} />
          <input ref={insuranceInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleInsuranceChange} />
        </div>
      )}

      <button
        className={styles.continueBtn}
        style={dg}
        disabled={!canContinue}
        onClick={() => {
          save({ licenceNumber: licenceNumber.trim() })
          router.push('/pro/signup/background')
        }}
      >
        {(certState === 'uploading' || insuranceState === 'uploading') ? t('proSignup.common.uploading') : t('proSignup.common.continue')}
      </button>

      <button
        className={styles.secondaryBtn}
        style={dg}
        onClick={() => {
          save({ licenceNumber: licenceNumber.trim() })
          router.push('/pro/signup/background')
        }}
      >
        {t('proSignup.credentials.uploadLater')}
      </button>
    </div>
  )
}

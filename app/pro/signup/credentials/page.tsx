'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MdCheckCircle, MdOutlineUploadFile } from 'react-icons/md'
import { load, save, stageFile } from '../store'
import styles from '../signup.module.css'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
type UploadState = 'idle' | 'uploading' | 'done' | 'error'

function UploadBox({ state, fileName, inputRef, onRetry }: {
  state: UploadState
  fileName: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onRetry: () => void
}) {
  if (state === 'done') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem' }}>
        <MdCheckCircle size={22} color="#16a34a" />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, color: '#15803d', margin: 0, fontSize: '0.9375rem' }}>Uploaded</p>
          {fileName && <p style={{ color: '#6b7280', margin: 0, fontSize: '0.8125rem' }}>{fileName}</p>}
        </div>
        <button onClick={onRetry} style={{ fontSize: '0.8125rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>Replace</button>
      </div>
    )
  }
  return (
    <div
      className={`${styles.uploadArea} ${state === 'uploading' ? styles.uploadAreaActive : ''}`}
      style={{ cursor: state === 'uploading' ? 'wait' : 'pointer' }}
      onClick={() => state !== 'uploading' && inputRef.current?.click()}
    >
      <MdOutlineUploadFile size={28} color="#f97316" style={{ margin: '0 auto 0.5rem' }} />
      {state === 'uploading' && <p className={styles.uploadTitle}>Uploading…</p>}
      {state === 'error' && <p className={styles.uploadTitle} style={{ color: '#ef4444' }}>Upload failed — click to retry</p>}
      {state === 'idle' && (
        <>
          <p className={styles.uploadTitle}>Upload document</p>
          <p className={styles.uploadHint}>PDF, JPG or PNG · max 10 MB</p>
        </>
      )}
    </div>
  )
}

export default function CredentialsPage() {
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

  async function handleCertChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFileName(file.name)
    stageFile('certificate', file)
    save({ certificateUrl: '' })
    setCertState('done')
  }

  async function handleInsuranceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setInsuranceFileName(file.name)
    stageFile('insurance', file)
    save({ insuranceUrl: '' })
    setInsuranceState('done')
  }

  if (!isRegulated) {
    return (
      <div className={styles.stepPage}>
        <button className={styles.back} onClick={() => router.back()}>← Back</button>
        <h1 className={styles.stepTitle} style={dg}>Trade credentials</h1>
        <p className={styles.stepSubtitle}>
          <strong>{data.categoryName}</strong> is an unregulated trade — no licence or certificate is required. You&apos;re good to move on.
        </p>
        <button className={styles.continueBtn} style={dg} onClick={() => router.push('/pro/signup/background')}>
          Continue
        </button>
      </div>
    )
  }

  const canContinue = certState === 'done' && (!needsInsurance || insuranceState === 'done')

  return (
    <div className={styles.stepPage}>
      <button className={styles.back} onClick={() => router.back()}>← Back</button>
      <h1 className={styles.stepTitle} style={dg}>Trade credentials</h1>
      <p className={styles.stepSubtitle}>
        <strong>{data.categoryName}</strong> is a regulated trade in Hungary. Upload your certificate so customers know you&apos;re qualified.
      </p>

      <div className={styles.field}>
        <label className={styles.label}>Licence number <span className={styles.labelHint}>OKKJ or equivalent</span></label>
        <input className={styles.input} placeholder="e.g. HU-OKKJ-12345" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Certificate</label>
        <UploadBox state={certState} fileName={certFileName} inputRef={certInputRef}
          onRetry={() => { setCertState('idle'); setCertFileName(null) }} />
        <input ref={certInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleCertChange} />
      </div>

      {needsInsurance && (
        <div className={styles.field}>
          <label className={styles.label}>Proof of liability insurance</label>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
            Required for structural and gas work.
          </p>
          <UploadBox state={insuranceState} fileName={insuranceFileName} inputRef={insuranceInputRef}
            onRetry={() => { setInsuranceState('idle'); setInsuranceFileName(null) }} />
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
        {(certState === 'uploading' || insuranceState === 'uploading') ? 'Uploading…' : 'Continue'}
      </button>

      <button
        className={styles.secondaryBtn}
        style={dg}
        onClick={() => {
          save({ licenceNumber: licenceNumber.trim() })
          router.push('/pro/signup/background')
        }}
      >
        I&apos;ll upload these later
      </button>
    </div>
  )
}

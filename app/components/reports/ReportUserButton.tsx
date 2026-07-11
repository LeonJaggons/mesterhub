'use client'

import { useEffect, useId, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { useTranslations } from '@/lib/i18n/client'

type TargetRole = 'pro' | 'customer' | 'user'
type ReporterRole = 'pro' | 'customer' | 'user'
type ContextType = 'pro_profile' | 'request' | 'conversation'

type Props = {
  targetUid: string
  targetRole: TargetRole
  targetName: string
  reporterRole?: ReporterRole
  contextType: ContextType
  requestId?: string
  className?: string
  buttonLabel?: string
}

const REPORT_REASONS = [
  { value: 'Spam or scam', labelKey: 'spam' },
  { value: 'Harassment or abusive behavior', labelKey: 'harassment' },
  { value: 'Unsafe or threatening conduct', labelKey: 'unsafe' },
  { value: 'False profile, identity, or credentials', labelKey: 'falseProfile' },
  { value: 'Payment, quote, or refund issue', labelKey: 'payment' },
  { value: 'No-show or appointment problem', labelKey: 'noShow' },
  { value: 'Inappropriate messages or content', labelKey: 'inappropriate' },
  { value: 'Other safety concern', labelKey: 'other' },
] as const

type ReportReason = (typeof REPORT_REASONS)[number]['value']

export default function ReportUserButton({
  targetUid,
  targetRole,
  targetName,
  reporterRole = 'user',
  contextType,
  requestId,
  className,
  buttonLabel,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations()
  const detailsId = useId()
  const [currentUid, setCurrentUid] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>(REPORT_REASONS[0].value)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    return onAuthChange(user => {
      setCurrentUid(user?.uid ?? null)
    })
  }, [])

  if (!targetUid || currentUid === targetUid) return null

  function openReport() {
    if (!currentUid) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`)
      return
    }
    setError('')
    setSuccess('')
    setOpen(true)
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (details.trim().length < 10) {
      setError(t('reports.validation'))
      return
    }

    setSubmitting(true)
    try {
      await authenticatedFetch('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          targetUid,
          targetRole,
          targetName,
          reporterRole,
          contextType,
          requestId,
          reason,
          details,
          path: pathname,
        }),
      })
      setSuccess(t('reports.success'))
      setDetails('')
      setReason(REPORT_REASONS[0].value)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReport}
        className={className ?? 'rounded-md border border-red-100 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer'}
      >
        {buttonLabel ?? t(`reports.button.${targetRole === 'pro' ? 'pro' : targetRole === 'customer' ? 'customer' : 'user'}`)}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red-500">{t('reports.kicker')}</p>
                <h2 className="text-2xl font-black text-gray-950" style={{ fontFamily: 'var(--font-darker-grotesque)' }}>
                  {t('reports.title', { name: targetName || t('reports.userFallback') })}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {t('reports.body')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-none bg-transparent p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label={t('reports.closeAria')}
              >
                ×
              </button>
            </div>

            <form onSubmit={submitReport} className="flex flex-col gap-4 p-6">
              <label className="text-sm font-bold text-gray-700">
                {t('reports.reason')}
                <select
                  value={reason}
                  onChange={event => setReason(event.target.value as ReportReason)}
                  className="mt-1 w-full rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  {REPORT_REASONS.map(option => (
                    <option key={option.value} value={option.value}>{t(`reports.reasons.${option.labelKey}`)}</option>
                  ))}
                </select>
              </label>

              <label htmlFor={detailsId} className="text-sm font-bold text-gray-700">
                {t('reports.details')}
                <textarea
                  id={detailsId}
                  value={details}
                  onChange={event => setDetails(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder={t('reports.detailsPlaceholder')}
                  className="mt-1 w-full resize-none rounded-md border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <p className="rounded-md border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                {t('reports.emergency')}
              </p>

              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
              {success && <p className="text-sm font-semibold text-green-700">{success}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  {t('reports.close')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || details.trim().length < 10}
                  className="flex-1 rounded-md border-none bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? t('reports.sending') : t('reports.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

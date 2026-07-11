'use client'

import { useEffect, useId, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import { authenticatedFetch } from '@/firebase/apiClient'
import { useTranslations } from '@/lib/i18n/client'
import { Modal, ModalHeader } from '@/app/components/ui/Modal'
import { Button } from '@/app/components/ui/Button'
import { Field, TextArea, Select, FieldError } from '@/app/components/ui/FormField'

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
        <Modal onClose={() => setOpen(false)}>
          <ModalHeader
            kicker={t('reports.kicker')}
            title={t('reports.title', { name: targetName || t('reports.userFallback') })}
            subtitle={t('reports.body')}
            onClose={() => setOpen(false)}
            closeLabel={t('reports.closeAria')}
            accent="red"
          />

          <form onSubmit={submitReport} className="flex flex-col gap-4 p-6">
            <Field label={t('reports.reason')} htmlFor="report-reason">
              <Select
                id="report-reason"
                value={reason}
                onChange={event => setReason(event.target.value as ReportReason)}
              >
                {REPORT_REASONS.map(option => (
                  <option key={option.value} value={option.value}>{t(`reports.reasons.${option.labelKey}`)}</option>
                ))}
              </Select>
            </Field>

            <Field label={t('reports.details')} htmlFor={detailsId}>
              <TextArea
                id={detailsId}
                value={details}
                onChange={event => setDetails(event.target.value)}
                rows={5}
                maxLength={2000}
                placeholder={t('reports.detailsPlaceholder')}
              />
            </Field>

            <p className="rounded-md border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              {t('reports.emergency')}
            </p>

            {error && <FieldError>{error}</FieldError>}
            {success && <p className="text-sm font-semibold text-green-700">{success}</p>}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="secondary" full onClick={() => setOpen(false)}>
                {t('reports.close')}
              </Button>
              <Button type="submit" variant="destructive" full disabled={submitting || details.trim().length < 10}>
                {submitting ? t('reports.sending') : t('reports.submit')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

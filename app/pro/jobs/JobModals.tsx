'use client'

import { useState } from 'react'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'
import { dg } from '@/lib/ui'
import { Modal, ModalHeader } from '@/app/components/ui/Modal'
import { Button } from '@/app/components/ui/Button'
import { Field, TextInput, TextArea, Select, FieldError } from '@/app/components/ui/FormField'


type Translator = ReturnType<typeof useTranslations>

const TIMELINE_OPTIONS = [
  { value: 'Within 24 hours', labelKey: 'within24Hours' },
  { value: '2–3 days', labelKey: 'twoToThreeDays' },
  { value: 'This week', labelKey: 'thisWeek' },
  { value: 'Next week', labelKey: 'nextWeek' },
  { value: "I'll confirm once we talk", labelKey: 'confirmAfterTalk' },
] as const

export function translateQuoteTimeline(t: Translator, timeline: string): string {
  const option = TIMELINE_OPTIONS.find(option => option.value === timeline)
  return option ? t(`proJobs.quoteModal.timelineOptions.${option.labelKey}`) : timeline
}

export type QuoteFormData = { price: string; timeline: string; notes: string }

export function QuoteModal({ categoryName, onClose, onSubmit }: {
  categoryName: string
  onClose: () => void
  onSubmit: (data: QuoteFormData) => Promise<void>
}) {
  const t = useTranslations()
  const [price, setPrice] = useState('')
  const [timeline, setTimeline] = useState<string>(TIMELINE_OPTIONS[0].value)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const categoryLabel = translateCategory(t, categoryName)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!price.trim()) { setError(t('proJobs.quoteModal.errors.priceRequired')); return }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({ price: price.trim(), timeline, notes: notes.trim() })
    } catch {
      setError(t('proJobs.quoteModal.errors.generic'))
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} scroll>
      <ModalHeader
        kicker={t('proJobs.quoteModal.kicker')}
        title={t('proJobs.quoteModal.title', { category: categoryLabel })}
        onClose={onClose}
        closeLabel={t('proJobs.quoteModal.close')}
      />

      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        <Field label={t('proJobs.quoteModal.priceLabel')} htmlFor="q-price" required hint={t('proJobs.quoteModal.priceHint')}>
          <TextInput
            id="q-price"
            type="text"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder={t('proJobs.quoteModal.pricePlaceholder')}
          />
        </Field>

        <Field label={t('proJobs.quoteModal.timelineLabel')} htmlFor="q-timeline">
          <Select id="q-timeline" value={timeline} onChange={e => setTimeline(e.target.value)}>
            {TIMELINE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {t(`proJobs.quoteModal.timelineOptions.${opt.labelKey}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('proJobs.quoteModal.notesLabel')} htmlFor="q-notes" optional={t('proJobs.quoteModal.optional')}>
          <TextArea
            id="q-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={4}
            placeholder={t('proJobs.quoteModal.notesPlaceholder')}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <div className="flex gap-3 pt-1">
          <Button type="submit" variant="primary" full disabled={submitting || !price.trim()}>
            {submitting ? t('proJobs.quoteModal.sending') : t('proJobs.quoteModal.submit')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="px-5 flex-none">
            {t('proJobs.quoteModal.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function DeclineModal({ onClose, onConfirm }: {
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const t = useTranslations()
  const [confirming, setConfirming] = useState(false)

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
    } catch {
      setConfirming(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="md">
      <div className="p-6">
        <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ ...dg, letterSpacing: '-0.02em' }}>
          {t('proJobs.declineModal.title')}
        </h2>
        <p className="text-sm text-gray-500 mb-5">{t('proJobs.declineModal.subtitle')}</p>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 flex gap-3 items-start">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" className="text-amber-500 flex-shrink-0 mt-0.5">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-bold text-amber-800 mb-2">{t('proJobs.declineModal.beforeTitle')}</p>
            <ul className="text-sm text-amber-700 flex flex-col gap-1.5">
              {['customerNotified', 'visibility', 'permanentlyClosed'].map(item => (
                <li key={item} className="flex gap-2">
                  <span className="flex-shrink-0">·</span>
                  <span>{t(`proJobs.declineModal.bullets.${item}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" full onClick={onClose}>
            {t('proJobs.declineModal.keep')}
          </Button>
          <Button type="button" variant="danger" full onClick={handleConfirm} disabled={confirming}>
            {confirming ? t('proJobs.declineModal.declining') : t('proJobs.declineModal.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

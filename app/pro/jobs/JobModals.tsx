'use client'

import { useState } from 'react'
import { useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">{t('proJobs.quoteModal.kicker')}</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {t('proJobs.quoteModal.title', { category: categoryLabel })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer flex-shrink-0 p-1"
            aria-label={t('proJobs.quoteModal.close')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {/* Price */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-price" className="text-sm font-bold text-gray-700">
              {t('proJobs.quoteModal.priceLabel')} <span className="text-orange-500">*</span>
            </label>
            <input
              id="q-price"
              type="text"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder={t('proJobs.quoteModal.pricePlaceholder')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
            <p className="text-xs text-gray-400">
              {t('proJobs.quoteModal.priceHint')}
            </p>
          </div>

          {/* Timeline */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-timeline" className="text-sm font-bold text-gray-700">
              {t('proJobs.quoteModal.timelineLabel')}
            </label>
            <select
              id="q-timeline"
              value={timeline}
              onChange={e => setTimeline(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              {TIMELINE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {t(`proJobs.quoteModal.timelineOptions.${opt.labelKey}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="q-notes" className="text-sm font-bold text-gray-700">
              {t('proJobs.quoteModal.notesLabel')}{' '}
              <span className="text-gray-400 font-normal">({t('proJobs.quoteModal.optional')})</span>
            </label>
            <textarea
              id="q-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={t('proJobs.quoteModal.notesPlaceholder')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || !price.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl py-3 text-base transition-colors border-none cursor-pointer"
              style={dg}
            >
              {submitting ? t('proJobs.quoteModal.sending') : t('proJobs.quoteModal.submit')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-xl text-sm transition-colors cursor-pointer bg-white"
            >
              {t('proJobs.quoteModal.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-2xl font-black text-gray-900 mb-1" style={{ ...dg, letterSpacing: '-0.02em' }}>
            {t('proJobs.declineModal.title')}
          </h2>
          <p className="text-sm text-gray-500 mb-5">{t('proJobs.declineModal.subtitle')}</p>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex gap-3 items-start">
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
            <button
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm transition-colors cursor-pointer bg-white"
            >
              {t('proJobs.declineModal.keep')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-black rounded-xl py-3 text-sm transition-colors cursor-pointer border-none"
              style={dg}
            >
              {confirming ? t('proJobs.declineModal.declining') : t('proJobs.declineModal.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

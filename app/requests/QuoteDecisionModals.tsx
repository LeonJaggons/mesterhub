'use client'

import { useState } from 'react'
import type { AcceptQuoteInput } from '@/firebase/conversations'
import AddressAutocompleteInput from '@/app/components/AddressAutocompleteInput'
import { useTranslations } from '@/lib/i18n/client'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const START_OPTIONS = [
  { value: 'As soon as possible', labelKey: 'asap' },
  { value: 'Within 24 hours', labelKey: 'within24' },
  { value: 'This week', labelKey: 'thisWeek' },
  { value: 'Next week', labelKey: 'nextWeek' },
  { value: 'Flexible — will coordinate in messages', labelKey: 'flexible' },
]

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useTranslations()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-lg shadow-2xl overflow-y-auto"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-sky-500 mb-1">{subtitle}</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer shrink-0 p-1"
            aria-label={t('customerRequests.detail.common.close')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function AcceptQuoteModal({
  proName,
  onClose,
  onSubmit,
}: {
  proName: string
  onClose: () => void
  onSubmit: (data: AcceptQuoteInput) => Promise<void>
}) {
  const t = useTranslations()
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [preferredStart, setPreferredStart] = useState(START_OPTIONS[0].value)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const canSubmit = Boolean(message.trim() && phone.trim() && address.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanedPhone = phone.replace(/\s+/g, '')
    if (!message.trim()) {
      setError(t('customerRequests.detail.acceptModal.errors.message'))
      return
    }
    if (!phone.trim()) {
      setError(t('customerRequests.detail.acceptModal.errors.phone'))
      return
    }
    if (!PHONE_PATTERN.test(cleanedPhone)) {
      setError(t('customerRequests.detail.acceptModal.errors.phoneFormat'))
      return
    }
    if (!address.trim()) {
      setError(t('customerRequests.detail.acceptModal.errors.address'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        message: message.trim(),
        phone: cleanedPhone,
        address: address.trim(),
        preferredStart,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('customerRequests.detail.acceptModal.errors.generic'))
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      subtitle={t('customerRequests.detail.acceptModal.kicker')}
      title={t('customerRequests.detail.acceptModal.title', { name: proName })}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <p className="text-sm text-gray-500 -mt-1">
          {t('customerRequests.detail.acceptModal.body', { name: proName })}
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-message" className="text-sm font-bold text-gray-700">
            {t('customerRequests.detail.acceptModal.messageLabel')} <span className="text-sky-500">*</span>
          </label>
          <textarea
            id="accept-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder={t('customerRequests.detail.acceptModal.messagePlaceholder')}
            className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-phone" className="text-sm font-bold text-gray-700">
            {t('customerRequests.detail.acceptModal.phoneLabel')} <span className="text-sky-500">*</span>
          </label>
          <input
            id="accept-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+36301234567"
            pattern="\+[1-9][0-9]{7,14}"
            title={t('customerRequests.detail.acceptModal.phoneTitle')}
            required
            className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-address" className="text-sm font-bold text-gray-700">
            {t('customerRequests.detail.acceptModal.addressLabel')} <span className="text-sky-500">*</span>
          </label>
          <AddressAutocompleteInput
            id="accept-address"
            value={address}
            onChange={setAddress}
            placeholder={t('customerRequests.detail.acceptModal.addressPlaceholder')}
            required
            className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-start" className="text-sm font-bold text-gray-700">
            {t('customerRequests.detail.acceptModal.startLabel')}
          </label>
          <select
            id="accept-start"
            value={preferredStart}
            onChange={e => setPreferredStart(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            {START_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(`customerRequests.detail.acceptModal.startOptions.${opt.labelKey}`)}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white font-black rounded-md py-3 text-base transition-colors border-none cursor-pointer"
            style={dg}
          >
            {submitting ? t('customerRequests.detail.acceptModal.accepting') : t('customerRequests.detail.acceptModal.submit')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-md text-sm cursor-pointer bg-white"
          >
            {t('customerRequests.detail.common.cancel')}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export function DeclineQuoteModal({
  proName,
  onClose,
  onConfirm,
}: {
  proName: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const t = useTranslations()
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('customerRequests.detail.declineModal.error'))
      setConfirming(false)
    }
  }

  return (
    <ModalShell subtitle={t('customerRequests.detail.declineModal.kicker')} title={t('customerRequests.detail.declineModal.title', { name: proName })} onClose={onClose}>
      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">
          {t('customerRequests.detail.declineModal.body')}
        </p>

        <div className="flex flex-col gap-1.5 mb-5">
          <label htmlFor="decline-reason" className="text-sm font-bold text-gray-700">
            {t('customerRequests.detail.declineModal.reasonLabel')} <span className="text-gray-400 font-normal">{t('customerRequests.detail.common.optional')}</span>
          </label>
          <textarea
            id="decline-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder={t('customerRequests.detail.declineModal.reasonPlaceholder')}
            className="w-full border border-gray-200 rounded-md px-4 py-3 text-sm resize-none focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-md py-3 text-sm cursor-pointer bg-white"
          >
            {t('customerRequests.detail.declineModal.keep')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black rounded-md py-3 text-sm cursor-pointer border-none"
            style={dg}
          >
            {confirming ? t('customerRequests.detail.declineModal.declining') : t('customerRequests.detail.declineModal.confirm')}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

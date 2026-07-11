'use client'

import { useState } from 'react'
import type { AcceptQuoteInput } from '@/firebase/conversations'
import AddressAutocompleteInput from '@/app/components/AddressAutocompleteInput'
import { useTranslations } from '@/lib/i18n/client'
import { Modal, ModalHeader } from '@/app/components/ui/Modal'
import { Button } from '@/app/components/ui/Button'
import { Field, TextInput, TextArea, Select, FieldError, FIELD_CLASSES } from '@/app/components/ui/FormField'


const START_OPTIONS = [
  { value: 'As soon as possible', labelKey: 'asap' },
  { value: 'Within 24 hours', labelKey: 'within24' },
  { value: 'This week', labelKey: 'thisWeek' },
  { value: 'Next week', labelKey: 'nextWeek' },
  { value: 'Flexible — will coordinate in messages', labelKey: 'flexible' },
]

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/

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
    <Modal onClose={onClose} scroll>
      <ModalHeader
        kicker={t('customerRequests.detail.acceptModal.kicker')}
        title={t('customerRequests.detail.acceptModal.title', { name: proName })}
        onClose={onClose}
        closeLabel={t('customerRequests.detail.common.close')}
      />
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <p className="text-sm text-gray-500 -mt-1">
          {t('customerRequests.detail.acceptModal.body', { name: proName })}
        </p>

        <Field label={t('customerRequests.detail.acceptModal.messageLabel')} htmlFor="accept-message" required>
          <TextArea
            id="accept-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder={t('customerRequests.detail.acceptModal.messagePlaceholder')}
          />
        </Field>

        <Field label={t('customerRequests.detail.acceptModal.phoneLabel')} htmlFor="accept-phone" required>
          <TextInput
            id="accept-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+36301234567"
            pattern="\+[1-9][0-9]{7,14}"
            title={t('customerRequests.detail.acceptModal.phoneTitle')}
            required
          />
        </Field>

        <Field label={t('customerRequests.detail.acceptModal.addressLabel')} htmlFor="accept-address" required>
          <AddressAutocompleteInput
            id="accept-address"
            value={address}
            onChange={setAddress}
            placeholder={t('customerRequests.detail.acceptModal.addressPlaceholder')}
            required
            className={FIELD_CLASSES}
          />
        </Field>

        <Field label={t('customerRequests.detail.acceptModal.startLabel')} htmlFor="accept-start">
          <Select id="accept-start" value={preferredStart} onChange={e => setPreferredStart(e.target.value)}>
            {START_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{t(`customerRequests.detail.acceptModal.startOptions.${opt.labelKey}`)}</option>
            ))}
          </Select>
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <div className="flex gap-3 pt-1">
          <Button type="submit" variant="primary" full disabled={submitting || !canSubmit}>
            {submitting ? t('customerRequests.detail.acceptModal.accepting') : t('customerRequests.detail.acceptModal.submit')}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="px-5 flex-none">
            {t('customerRequests.detail.common.cancel')}
          </Button>
        </div>
      </form>
    </Modal>
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
    <Modal onClose={onClose}>
      <ModalHeader
        kicker={t('customerRequests.detail.declineModal.kicker')}
        title={t('customerRequests.detail.declineModal.title', { name: proName })}
        onClose={onClose}
        closeLabel={t('customerRequests.detail.common.close')}
      />
      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">
          {t('customerRequests.detail.declineModal.body')}
        </p>

        <div className="mb-5">
          <Field
            label={t('customerRequests.detail.declineModal.reasonLabel')}
            htmlFor="decline-reason"
            optional={t('customerRequests.detail.common.optional')}
          >
            <TextArea
              id="decline-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder={t('customerRequests.detail.declineModal.reasonPlaceholder')}
            />
          </Field>
        </div>

        {error && <div className="mb-4"><FieldError>{error}</FieldError></div>}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" full onClick={onClose}>
            {t('customerRequests.detail.declineModal.keep')}
          </Button>
          <Button
            type="button"
            variant="danger"
            full
            onClick={handleConfirm}
            disabled={confirming}
            className="bg-slate-800 hover:bg-slate-900"
          >
            {confirming ? t('customerRequests.detail.declineModal.declining') : t('customerRequests.detail.declineModal.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

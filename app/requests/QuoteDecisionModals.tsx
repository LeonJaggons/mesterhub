'use client'

import { useState } from 'react'
import type { AcceptQuoteInput } from '@/firebase/conversations'

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const

const START_OPTIONS = [
  'As soon as possible',
  'Within 24 hours',
  'This week',
  'Next week',
  'Flexible — will coordinate in messages',
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
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-orange-500 mb-1">{subtitle}</p>
            <h2 className="text-2xl font-black text-gray-900" style={{ ...dg, letterSpacing: '-0.02em' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer shrink-0 p-1"
            aria-label="Close"
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
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [preferredStart, setPreferredStart] = useState(START_OPTIONS[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const canSubmit = Boolean(message.trim() && phone.trim() && address.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanedPhone = phone.replace(/\s+/g, '')
    if (!message.trim()) {
      setError('Please write a message so the pro knows how to reach you.')
      return
    }
    if (!phone.trim()) {
      setError('Please add a phone number so the pro can reach you.')
      return
    }
    if (!PHONE_PATTERN.test(cleanedPhone)) {
      setError('Enter your phone number with country code and digits only, e.g. +36301234567.')
      return
    }
    if (!address.trim()) {
      setError('Please add the service address for the appointment.')
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
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      subtitle="Accept quote"
      title={`Hire ${proName}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
        <p className="text-sm text-gray-500 -mt-1">
          Your message and contact details are shared with {proName} so you can coordinate the job.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-message" className="text-sm font-bold text-gray-700">
            First message <span className="text-orange-500">*</span>
          </label>
          <textarea
            id="accept-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            placeholder="Hi! I'd like to move forward. I'm available…"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-phone" className="text-sm font-bold text-gray-700">
            Phone number <span className="text-orange-500">*</span>
          </label>
          <input
            id="accept-phone"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+36301234567"
            pattern="\+[1-9][0-9]{7,14}"
            title="Use country code and digits only, for example +36301234567."
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-address" className="text-sm font-bold text-gray-700">
            Full address <span className="text-orange-500">*</span>
          </label>
          <input
            id="accept-address"
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Street, building, floor, door"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="accept-start" className="text-sm font-bold text-gray-700">
            When would you like to start?
          </label>
          <select
            id="accept-start"
            value={preferredStart}
            onChange={e => setPreferredStart(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          >
            {START_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black rounded-xl py-3 text-base transition-colors border-none cursor-pointer"
            style={dg}
          >
            {submitting ? 'Accepting…' : 'Accept & send message'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium rounded-xl text-sm cursor-pointer bg-white"
          >
            Cancel
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
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setConfirming(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setConfirming(false)
    }
  }

  return (
    <ModalShell subtitle="Decline quote" title={`Decline ${proName}'s quote?`} onClose={onClose}>
      <div className="p-6">
        <p className="text-sm text-gray-500 mb-4">
          The pro will be notified. You can request quotes from other pros anytime.
        </p>

        <div className="flex flex-col gap-1.5 mb-5">
          <label htmlFor="decline-reason" className="text-sm font-bold text-gray-700">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="decline-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Price is above my budget"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
          />
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl py-3 text-sm cursor-pointer bg-white"
          >
            Keep quote
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-black rounded-xl py-3 text-sm cursor-pointer border-none"
            style={dg}
          >
            {confirming ? 'Declining…' : 'Decline quote'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

'use client'

import { createPortal } from 'react-dom'
import { dg } from '@/lib/ui'

const MAX_WIDTH = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
} as const

export function Modal({ onClose, maxWidth = 'lg', scroll = false, children }: {
  onClose: () => void
  maxWidth?: keyof typeof MAX_WIDTH
  scroll?: boolean
  children: React.ReactNode
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
    >
      <div
        className={`w-full ${MAX_WIDTH[maxWidth]} rounded-lg bg-white shadow-2xl ${scroll ? 'overflow-y-auto' : ''}`}
        style={scroll ? { maxHeight: '90vh' } : undefined}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({ kicker, title, subtitle, onClose, closeLabel, accent = 'sky' }: {
  kicker?: string
  title: string
  subtitle?: string
  onClose: () => void
  closeLabel: string
  accent?: 'sky' | 'red'
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
      <div>
        {kicker && (
          <p className={`mb-1 text-xs font-bold uppercase tracking-widest ${accent === 'red' ? 'text-red-500' : 'text-sky-500'}`}>
            {kicker}
          </p>
        )}
        <h2 className="text-2xl font-black text-gray-950" style={{ ...dg, letterSpacing: '-0.02em' }}>
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex-shrink-0 border-none bg-transparent p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
        aria-label={closeLabel}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  )
}

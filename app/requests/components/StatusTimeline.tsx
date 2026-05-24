'use client'

import type { ServiceRequestStatus } from '@/firebase/serviceRequests'

const STEPS: { key: ServiceRequestStatus; label: string }[] = [
  { key: 'pending', label: 'Request sent' },
  { key: 'quoted', label: 'Quote received' },
  { key: 'accepted', label: 'Job confirmed' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_COPY: Record<ServiceRequestStatus, { eyebrow: string; title: string; body: string }> = {
  pending: {
    eyebrow: 'Current step',
    title: 'Request sent',
    body: 'Your request is with the pro. They can review the details and send a quote when ready.',
  },
  quoted: {
    eyebrow: 'Action needed',
    title: 'Quote received',
    body: 'Review the price, timeline, and notes. You can accept the quote or decline it.',
  },
  accepted: {
    eyebrow: 'Current step',
    title: 'Job confirmed',
    body: 'You hired the pro. Use messages to coordinate details and confirm any appointment requests.',
  },
  completed: {
    eyebrow: 'Current step',
    title: 'Completed',
    body: 'The job is marked complete. Your request history and conversation remain available.',
  },
  declined: {
    eyebrow: 'Request closed',
    title: 'Declined',
    body: 'This request is no longer active. You can start a new request from the pro profile.',
  },
  cancelled: {
    eyebrow: 'Request closed',
    title: 'Cancelled',
    body: 'This request was cancelled. Your request history and messages remain available.',
  },
}

function stepIndex(status: ServiceRequestStatus): number {
  if (status === 'declined' || status === 'cancelled') return -1
  if (status === 'completed') return 3
  if (status === 'accepted') return 2
  if (status === 'quoted') return 1
  return 0
}

export default function StatusTimeline({ status }: { status: ServiceRequestStatus }) {
  const current = stepIndex(status)
  const closed = status === 'declined' || status === 'cancelled'
  const copy = STATUS_COPY[status]

  const currentCard = (
    <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:w-[240px] md:shrink-0">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-orange-500">
        {copy.eyebrow}
      </p>
      <h2 className="text-lg font-black leading-tight text-gray-900">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-5 text-gray-500">
        {copy.body}
      </p>
    </aside>
  )

  if (closed) {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {currentCard}
        <div className="rounded-2xl bg-white border border-gray-200 px-4 py-4 text-sm font-medium text-gray-600 text-center shadow-sm md:flex md:flex-1 md:items-center md:justify-center">
          This request was {status}.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      {currentCard}
      <ol
        aria-label="Request progress"
        className="grid grid-cols-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm md:flex-1 md:items-center"
      >
        {STEPS.map((step, i) => {
          const done = current > i
          const active = current === i
          const reached = done || active
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center">
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute left-[calc(50%+1rem)] right-[calc(-50%+1rem)] top-4 h-0.5 ${
                    done ? 'bg-slate-800' : 'bg-gray-200'
                  }`}
                  aria-hidden
                />
              )}
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-sm ${
                    done
                      ? 'bg-slate-800 border-slate-800 text-white'
                      : active
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </div>
                <span
                  className={`mt-2 max-w-20 text-[11px] font-semibold leading-tight sm:text-xs ${
                    active ? 'text-gray-900' : reached ? 'text-slate-700' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

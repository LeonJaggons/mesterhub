'use client'

import type { ServiceRequestStatus } from '@/firebase/serviceRequests'
import { useTranslations } from '@/lib/i18n/client'

const STEPS: { key: ServiceRequestStatus; labelKey: string }[] = [
  { key: 'pending', labelKey: 'pending' },
  { key: 'quoted', labelKey: 'quoted' },
  { key: 'accepted', labelKey: 'accepted' },
  { key: 'completed', labelKey: 'completed' },
]

function stepIndex(status: ServiceRequestStatus): number {
  if (status === 'declined' || status === 'cancelled') return -1
  if (status === 'completed') return 3
  if (status === 'accepted') return 2
  if (status === 'quoted') return 1
  return 0
}

export default function StatusTimeline({ status }: { status: ServiceRequestStatus }) {
  const t = useTranslations()
  const current = stepIndex(status)
  const closed = status === 'declined' || status === 'cancelled'

  const currentCard = (
    <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:w-[240px] md:shrink-0">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-sky-500">
        {t(`customerRequests.detail.timeline.${status}.eyebrow`)}
      </p>
      <h2 className="text-lg font-black leading-tight text-gray-900">
        {t(`customerRequests.detail.timeline.${status}.title`)}
      </h2>
      <p className="mt-2 text-sm leading-5 text-gray-500">
        {t(`customerRequests.detail.timeline.${status}.body`)}
      </p>
    </aside>
  )

  if (closed) {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {currentCard}
        <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 text-sm font-medium text-gray-600 text-center shadow-sm md:flex md:flex-1 md:items-center md:justify-center">
          {t('customerRequests.detail.timeline.closedLine', { status: t(`customerRequests.status.${status}`).toLowerCase() })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      {currentCard}
      <ol
        aria-label={t('customerRequests.detail.timeline.progressAria')}
        className="grid grid-cols-4 rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-sm md:flex-1 md:items-center"
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
                        ? 'bg-sky-500 border-sky-500 text-white'
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
                  {t(`customerRequests.detail.timeline.steps.${step.labelKey}`)}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

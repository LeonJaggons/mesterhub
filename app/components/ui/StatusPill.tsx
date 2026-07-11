import type { ServiceRequestStatus } from '@/firebase/serviceRequests'
import { STATUS_COLORS } from '@/app/requests/shared'

export function StatusPill({ status, children, className = '' }: {
  status: ServiceRequestStatus
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={`text-xs font-semibold border rounded-full px-2.5 py-1 shrink-0 ${STATUS_COLORS[status]} ${className}`}>
      {children}
    </span>
  )
}

import type { JobLocation, ServiceRequestStatus } from '@/firebase/serviceRequests'
import districtsData from '@/public/districts.json'

export type TimestampLike = {
  seconds?: number
  nanoseconds?: number
  _seconds?: number
  _nanoseconds?: number
  toMillis?: () => number
  toDate?: () => Date
} | number | string | Date

export type Quote = { price: string; timeline: string; notes: string }

export type AcceptanceDetails = {
  message: string
  phone?: string
  address?: string
  preferredStart?: string
  acceptedAt: TimestampLike | null
}

export type AppointmentKind = 'quote' | 'service'
export type AppointmentStatus = 'proposed' | 'confirmed'

export type CompletionDetails = {
  status?: 'pro_marked_complete' | 'confirmed_complete'
  proMarkedAt?: TimestampLike | null
  confirmedAt?: TimestampLike | null
}

export type RequestReview = {
  rating: number
  comment: string
  reviewedAt?: TimestampLike | null
}

export type AppointmentRequest = {
  kind: AppointmentKind
  date: string
  time: string
  duration: string
  location: string
  jobLocation?: JobLocation | null
  notes: string
  status: AppointmentStatus
  requestedAt: TimestampLike | null
  confirmedAt?: TimestampLike | null
}

export type ServiceRequest = {
  id: string
  projectId?: string
  proUid: string
  proName: string
  categoryName: string
  answers: Record<string, string>
  customerUid: string
  customerName?: string
  customerEmail?: string
  customerDistrict?: string
  jobLocation?: JobLocation
  attachmentUrls?: string[]
  status: ServiceRequestStatus
  quote?: Quote
  acceptance?: AcceptanceDetails
  appointmentRequest?: AppointmentRequest
  appointmentChangeRequest?: AppointmentRequest
  completion?: CompletionDetails
  review?: RequestReview
  declinedBy?: 'pro' | 'customer'
  declineReason?: string
  cancelledBy?: 'pro' | 'customer'
  cancelReason?: string
  createdAt: TimestampLike | null
}

export function requestStatusLabel(
  status: ServiceRequestStatus,
  declinedBy?: 'pro' | 'customer'
): string {
  if (status === 'declined' && declinedBy === 'customer') return 'You declined'
  if (status === 'declined' && declinedBy === 'pro') return 'Declined by pro'
  return STATUS_LABELS[status]
}

export type ProSummary = {
  uid: string
  fullName: string
  categoryName: string
  bio: string
  yearsExp: string
  pricingType: 'hourly' | 'fixed' | 'quote' | string
  hourlyRate: string
  services: string[]
  districts: number[]
  postcode: string
  avatarUrl: string | null
  backgroundCheck: boolean
  regulated: boolean
  subscriptionActive?: boolean
  subscriptionStatus?: string
  rating?: number
  reviewCount?: number
}

export function timestampMillis(value: unknown): number | null {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object') {
    const maybeTimestamp = value as {
      seconds?: number
      nanoseconds?: number
      _seconds?: number
      _nanoseconds?: number
      toMillis?: () => number
      toDate?: () => Date
    }
    if (typeof maybeTimestamp.toMillis === 'function') return maybeTimestamp.toMillis()
    if (typeof maybeTimestamp.toDate === 'function') return maybeTimestamp.toDate().getTime()
    const seconds = typeof maybeTimestamp.seconds === 'number'
      ? maybeTimestamp.seconds
      : maybeTimestamp._seconds
    const nanoseconds = typeof maybeTimestamp.nanoseconds === 'number'
      ? maybeTimestamp.nanoseconds
      : maybeTimestamp._nanoseconds
    if (typeof seconds === 'number') return seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1_000_000)
  }
  return null
}

export function nowTimestamp(): TimestampLike {
  return Date.now()
}

export const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  pending: 'Awaiting quote',
  quoted: 'Quote received',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** Brand: orange = primary, slate-800 = secondary dark blue */
export const STATUS_COLORS: Record<ServiceRequestStatus, string> = {
  pending: 'bg-orange-50 text-orange-700 border-orange-200',
  quoted: 'bg-slate-50 text-slate-800 border-slate-200',
  accepted: 'bg-slate-800 text-white border-slate-800',
  declined: 'bg-gray-100 text-gray-500 border-gray-200',
  completed: 'bg-slate-800 text-white border-slate-800',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const PRO_AVATAR_COLORS = ['#ea580c', '#1e293b'] as const

export const DISTRICT_COORDS: Record<string, [number, number]> = {
  I: [47.496, 19.039], II: [47.538, 18.983], III: [47.571, 19.043],
  IV: [47.596, 19.082], V: [47.503, 19.053], VI: [47.511, 19.07],
  VII: [47.501, 19.073], VIII: [47.491, 19.078], IX: [47.477, 19.067],
  X: [47.487, 19.112], XI: [47.472, 19.031], XII: [47.499, 18.988],
  XIII: [47.527, 19.06], XIV: [47.517, 19.103], XV: [47.562, 19.118],
  XVI: [47.524, 19.137], XVII: [47.502, 19.153], XVIII: [47.462, 19.12],
  XIX: [47.453, 19.097], XX: [47.444, 19.083], XXI: [47.431, 19.062],
  XXII: [47.435, 18.991], XXIII: [47.413, 19.071],
}

export const DEFAULT_COORDS: [number, number] = [47.4979, 19.0402]

const dg = { fontFamily: 'var(--font-darker-grotesque)' } as const
export { dg }


export function timeAgo(ts: TimestampLike | null): string {
  const millis = timestampMillis(ts)
  if (!millis) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function districtLabel(roman: string): string {
  const d = districtsData.districts.find(x => x.roman === roman)
  return d ? `${d.roman}. ${d.name}` : roman
}

export function districtNameById(id: number): string {
  return districtsData.districts.find(d => d.id === id)?.name ?? `District ${id}`
}

export function districtCoords(roman?: string): [number, number] {
  if (!roman) return DEFAULT_COORDS
  return DISTRICT_COORDS[roman] ?? DEFAULT_COORDS
}

export function requestCoords(req: { jobLocation?: JobLocation | null; customerDistrict?: string }): [number, number] {
  if (req.jobLocation) return [req.jobLocation.lat, req.jobLocation.lng]
  return districtCoords(req.customerDistrict)
}

export function appointmentCoords(
  req: { jobLocation?: JobLocation | null; customerDistrict?: string },
  appointment?: { jobLocation?: JobLocation | null }
): [number, number] {
  if (appointment?.jobLocation) return [appointment.jobLocation.lat, appointment.jobLocation.lng]
  return requestCoords(req)
}

export function approximateRadiusMeters(location?: JobLocation | null): number {
  return Math.max(Math.ceil(location?.accuracy ?? 700), 500)
}

export function approximateLocationLabel(location?: JobLocation | null): string {
  if (!location?.accuracy) return 'Approximate job location'
  const meters = approximateRadiusMeters(location)
  if (meters >= 1000) return `Approximate job location within ${(meters / 1000).toFixed(1)} km`
  return `Approximate job location within ${meters} m`
}

export function formatKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatVal(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function formatAnswers(answers: Record<string, string>) {
  return Object.entries(answers)
    .filter(([, v]) => v)
    .map(([k, v]) => ({ key: formatKey(k), value: formatVal(v) }))
}

export function pricingLabel(pro: ProSummary): string {
  if (pro.pricingType === 'hourly' && pro.hourlyRate) return `${pro.hourlyRate} / hour`
  if (pro.pricingType === 'fixed' && pro.hourlyRate) return `From ${pro.hourlyRate}`
  return 'Quote on request'
}

export async function fetchProSummary(uid: string): Promise<ProSummary | null> {
  try {
    const response = await fetch(`/api/pros/${encodeURIComponent(uid)}`)
    if (!response.ok) return null
    const data = (await response.json()) as { pro?: ProSummary | null }
    return data.pro ?? null
  } catch {
    return null
  }
}

export function proInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function proAvatarBg(name: string): string {
  return PRO_AVATAR_COLORS[name.charCodeAt(0) % PRO_AVATAR_COLORS.length]
}

import { Timestamp } from 'firebase/firestore'
import { authenticatedFetch } from './apiClient'
import type { JobLocation } from './serviceRequests'

export type Conversation = {
  requestId: string
  proUid: string
  customerUid: string
  proName: string
  customerName: string
  categoryName: string
  lastMessage: string
  lastMessageAt: Timestamp | null
  createdAt: Timestamp | null
}

export type Message = {
  id: string
  senderUid: string
  senderRole: 'customer' | 'pro'
  text: string
  createdAt: Timestamp | null
}

export type AcceptQuoteInput = {
  message: string
  phone?: string
  address?: string
  preferredStart?: string
}

export type AcceptanceDetails = {
  message: string
  phone: string
  address: string
  preferredStart: string
  acceptedAt: Timestamp | null
}

export type AppointmentKind = 'quote' | 'service'

export type AppointmentRequestInput = {
  kind: AppointmentKind
  date: string
  time: string
  duration: string
  location?: string
  jobLocation?: JobLocation | null
  notes?: string
}

/** Customer accepts a quote — updates request, opens conversation, sends first message. */
export async function acceptServiceQuote(
  requestId: string,
  customerUid: string,
  input: AcceptQuoteInput
): Promise<void> {
  const message = input.message.trim()
  if (!message) throw new Error('Please include a message for the pro.')
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'accept',
      customerUid,
      input: { ...input, message },
    }),
  })
}

function appointmentMessage(input: AppointmentRequestInput, isChangeRequest = false): string {
  const title = input.kind === 'quote' ? 'quote visit' : 'service appointment'
  if (isChangeRequest) {
    return `Appointment change requested for a ${title}. Please review and confirm the new time before it is applied.`
  }
  return `Appointment request sent for a ${title}. Please review and confirm it from your request details.`
}

/** Pro proposes a quote visit or service appointment to the customer. */
export async function requestAppointment(
  requestId: string,
  proUid: string,
  input: AppointmentRequestInput,
  options?: { isChangeRequest?: boolean }
): Promise<void> {
  if (!input.date || !input.time) throw new Error('Please choose a date and time.')
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'request-appointment',
      proUid,
      input,
      message: appointmentMessage(input, options?.isChangeRequest),
    }),
  })
}

/** Customer explicitly confirms the pro's proposed appointment. */
export async function confirmAppointment(
  requestId: string,
  customerUid: string
): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'confirm-appointment', customerUid }),
  })
}

/** Customer declines a quoted request. */
export async function declineServiceQuote(
  requestId: string,
  customerUid: string,
  reason?: string
): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'decline-customer', customerUid, reason }),
  })
}

/** Send a follow-up message in an existing conversation. */
export async function sendMessage(
  requestId: string,
  senderUid: string,
  senderRole: 'customer' | 'pro',
  text: string
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Message cannot be empty.')
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: 'send-message',
      senderUid,
      senderRole,
      text: trimmed,
    }),
  })
}

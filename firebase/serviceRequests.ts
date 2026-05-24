import { authenticatedFetch } from './apiClient'

export type ServiceRequestStatus = 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'

export type JobLocation = {
  lat: number
  lng: number
  accuracy?: number
}

export type NewServiceRequest = {
  projectId?: string
  proUid: string
  proName: string
  categoryName: string
  answers: Record<string, string>
  customerUid: string
  customerName: string
  customerEmail: string
  customerDistrict?: string   // Roman numeral e.g. "XI"
  jobLocation?: JobLocation | null
  attachmentUrls?: string[]
}

export type QuoteInput = {
  price: string
  timeline: string
  notes: string
}

/**
 * Write a service request to Firestore.
 * Stored at serviceRequests/{auto-id} so both the customer
 * and the pro can query by their respective UIDs.
 */
export async function createServiceRequest(req: NewServiceRequest): Promise<string> {
  const response = await authenticatedFetch('/api/service-requests', {
    method: 'POST',
    body: JSON.stringify(req),
  })
  const data = (await response.json()) as { id: string }
  return data.id
}

export async function quoteServiceRequest(requestId: string, quote: QuoteInput): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'quote', quote }),
  })
}

export async function declineServiceRequestAsPro(requestId: string): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'decline-pro' }),
  })
}

export async function markServiceRequestComplete(requestId: string): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'mark-complete' }),
  })
}

export async function confirmServiceRequestComplete(requestId: string): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'confirm-complete' }),
  })
}

export async function cancelServiceRequest(requestId: string, reason: string): Promise<void> {
  await authenticatedFetch(`/api/service-requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'cancel', reason }),
  })
}

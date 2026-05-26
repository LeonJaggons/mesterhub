import { adminDb } from '@/firebase/admin'
import { hasPaidProFeatures } from '@/lib/billing'
import { clearInquiryIdsByMonth } from '@/lib/inquiryAccess'

type FirestoreDoc = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>

type ProAccess = {
  hasProPlan: boolean
  clearRequestIds: Set<string>
}

function serializeFirestoreValue(value: unknown): unknown {
  if (!value) return value
  if (value instanceof Date) return value.getTime()
  if (typeof value !== 'object') return value
  if ('toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if ('toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime()
  if (Array.isArray(value)) return value.map(serializeFirestoreValue)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, serializeFirestoreValue(entry)]),
  )
}

function serializeRequestDoc(doc: FirestoreDoc): Record<string, unknown> {
  return { id: doc.id, ...serializeFirestoreValue(doc.data()) as Record<string, unknown> }
}

function createdAtMillis(doc: FirestoreDoc): number {
  const value = doc.data().createdAt
  if (value && typeof value === 'object' && typeof value.toMillis === 'function') return value.toMillis()
  return 0
}

function obfuscateRequest(request: Record<string, unknown>): Record<string, unknown> {
  return {
    id: request.id,
    projectId: request.projectId,
    proUid: request.proUid,
    proName: request.proName,
    categoryName: request.categoryName,
    status: request.status,
    createdAt: request.createdAt,
    obfuscated: true,
    customerName: 'New customer',
    customerEmail: '',
    answers: {},
  }
}

async function proAccess(proUid: string, docs: FirestoreDoc[]): Promise<ProAccess> {
  const proSnap = await adminDb.collection('pros').doc(proUid).get()
  const pro = proSnap.data()
  const hasProPlan = hasPaidProFeatures(pro?.subscriptionStatus, pro?.subscriptionCurrentPeriodEnd)
  return {
    hasProPlan,
    clearRequestIds: clearInquiryIdsByMonth(
      docs.map(doc => ({ id: doc.id, createdAt: doc.data().createdAt })),
      hasProPlan,
    ),
  }
}

export async function listProServiceRequests(proUid: string): Promise<{
  requests: Array<Record<string, unknown>>
  hasProPlan: boolean
}> {
  const snap = await adminDb.collection('serviceRequests').where('proUid', '==', proUid).get()
  const docs = [...snap.docs].sort((a, b) => createdAtMillis(b) - createdAtMillis(a))
  const access = await proAccess(proUid, docs)
  return {
    hasProPlan: access.hasProPlan,
    requests: docs.map(doc => {
      const request = serializeRequestDoc(doc)
      return access.clearRequestIds.has(doc.id) ? request : obfuscateRequest(request)
    }),
  }
}

export async function getProServiceRequest(
  proUid: string,
  requestId: string,
): Promise<Record<string, unknown> | null> {
  const [requestSnap, allRequestsSnap] = await Promise.all([
    adminDb.collection('serviceRequests').doc(requestId).get(),
    adminDb.collection('serviceRequests').where('proUid', '==', proUid).get(),
  ])
  if (!requestSnap.exists || requestSnap.data()?.proUid !== proUid) return null

  const access = await proAccess(proUid, allRequestsSnap.docs)
  const request = serializeRequestDoc(requestSnap as FirestoreDoc)
  return access.clearRequestIds.has(requestId) ? request : obfuscateRequest(request)
}

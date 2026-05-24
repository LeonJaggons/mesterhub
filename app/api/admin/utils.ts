import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore'

export function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export function serializeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (Array.isArray(value)) return value.map(serializeValue)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, serializeValue(nested)]),
  )
}

export function serializeDoc(doc: QueryDocumentSnapshot<DocumentData>): { id: string } & Record<string, unknown> {
  const data = serializeValue(doc.data()) as Record<string, unknown>
  return {
    id: doc.id,
    ...data,
  }
}

export function statusCounts<T extends string>(statuses: readonly T[], docs: Array<{ status?: string }>) {
  const counts = Object.fromEntries(statuses.map(status => [status, 0])) as Record<T, number>
  for (const doc of docs) {
    if (doc.status && doc.status in counts) counts[doc.status as T] += 1
  }
  return counts
}

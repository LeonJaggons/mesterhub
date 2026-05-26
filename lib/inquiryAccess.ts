export const FREE_CLEAR_INQUIRY_LIMIT = 3

export function isInquiryClearForPlan(index: number, hasProPlan: boolean): boolean {
  return hasProPlan || index < FREE_CLEAR_INQUIRY_LIMIT
}

export type InquiryTimestamp = Date | string | number | null | undefined | {
  _seconds?: number
  seconds?: number
  toDate?: () => Date
  toMillis?: () => number
}

export type InquiryForAccess = {
  id: string
  createdAt?: InquiryTimestamp
}

export function inquiryCreatedAtMillis(value: InquiryTimestamp, fallback = Date.now()): number {
  if (!value) return fallback
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : fallback
  }
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value._seconds === 'number') return value._seconds * 1000
  if (typeof value.seconds === 'number') return value.seconds * 1000
  return fallback
}

export function inquiryMonthKey(value: InquiryTimestamp, reference = new Date()): string {
  const date = new Date(inquiryCreatedAtMillis(value, reference.getTime()))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

export function clearInquiryIdsByMonth<T extends InquiryForAccess>(
  inquiries: T[],
  hasProPlan: boolean,
  reference = new Date(),
): Set<string> {
  if (hasProPlan) return new Set(inquiries.map(inquiry => inquiry.id))

  const clearIds = new Set<string>()
  const grouped = new Map<string, T[]>()
  for (const inquiry of inquiries) {
    const key = inquiryMonthKey(inquiry.createdAt, reference)
    grouped.set(key, [...(grouped.get(key) ?? []), inquiry])
  }

  for (const monthlyInquiries of grouped.values()) {
    monthlyInquiries
      .sort((a, b) => inquiryCreatedAtMillis(a.createdAt) - inquiryCreatedAtMillis(b.createdAt))
      .slice(0, FREE_CLEAR_INQUIRY_LIMIT)
      .forEach(inquiry => clearIds.add(inquiry.id))
  }

  return clearIds
}

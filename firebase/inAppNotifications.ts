import { FieldValue, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb } from './admin'

export type NotificationRole = 'customer' | 'pro'

export type NotificationType =
  | 'request.created'
  | 'quote.sent'
  | 'quote.accepted'
  | 'quote.declined'
  | 'appointment.proposed'
  | 'appointment.confirmed'
  | 'message.received'
  | 'completion.requested'
  | 'request.completed'
  | 'request.cancelled'
  | 'marketplace.quote_submitted'
  | 'marketplace.quote_accepted'
  | 'marketplace.quote_declined'

export type InAppNotification = {
  id: string
  recipientUid: string
  recipientRole: NotificationRole
  actorUid: string
  actorRole: NotificationRole
  type: NotificationType
  title: string
  body: string
  href: string
  requestId: string
  createdAt: string | null
  readAt: string | null
  metadata: Record<string, unknown>
}

export type CreateNotificationInput = {
  recipientUid: string
  recipientRole: NotificationRole
  actorUid: string
  actorRole: NotificationRole
  type: NotificationType
  title: string
  body: string
  href: string
  requestId: string
  metadata?: Record<string, unknown>
}

export function notificationItemsRef(uid: string) {
  return adminDb.collection('notifications').doc(uid).collection('items')
}

export async function createInAppNotification(input: CreateNotificationInput): Promise<void> {
  if (!input.recipientUid || input.recipientUid === input.actorUid) return

  try {
    await notificationItemsRef(input.recipientUid).add({
      recipientUid: input.recipientUid,
      recipientRole: input.recipientRole,
      actorUid: input.actorUid,
      actorRole: input.actorRole,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      requestId: input.requestId,
      readAt: null,
      metadata: input.metadata ?? {},
      createdAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    console.error('[inAppNotifications] create failed', err)
  }
}

function serializeTimestamp(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const timestamp = value as { toDate?: () => Date }
  return typeof timestamp.toDate === 'function' ? timestamp.toDate().toISOString() : null
}

export function serializeNotification(doc: QueryDocumentSnapshot): InAppNotification {
  const data = doc.data()
  return {
    id: doc.id,
    recipientUid: String(data.recipientUid ?? ''),
    recipientRole: data.recipientRole === 'pro' ? 'pro' : 'customer',
    actorUid: String(data.actorUid ?? ''),
    actorRole: data.actorRole === 'pro' ? 'pro' : 'customer',
    type: data.type as NotificationType,
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    href: String(data.href ?? '/'),
    requestId: String(data.requestId ?? ''),
    createdAt: serializeTimestamp(data.createdAt),
    readAt: serializeTimestamp(data.readAt),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
  }
}


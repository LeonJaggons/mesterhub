import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './admin'
import { emailConfigured, sendEmail } from './email'

type LifecycleEmail = {
  to?: string | null
  subject: string
  text: string
  bodyHtml?: string
  hideSubjectHeading?: boolean
  previewText?: string
  replyTo?: string
  event: string
  requestId?: string
  metadata?: Record<string, unknown>
}

type DeliveryStatus = 'sent' | 'skipped' | 'error'

async function recordEmail(input: LifecycleEmail, status: DeliveryStatus, error?: string, providerId?: string) {
  await adminDb.collection('mailEvents').add({
    to: input.to ?? null,
    subject: input.subject,
    text: input.text,
    bodyHtml: input.bodyHtml ?? null,
    previewText: input.previewText ?? null,
    event: input.event,
    requestId: input.requestId ?? null,
    metadata: input.metadata ?? {},
    status,
    error: error ?? null,
    provider: 'resend',
    providerId: providerId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function sendLifecycleEmail(input: LifecycleEmail): Promise<void> {
  if (!input.to) {
    await recordEmail(input, 'skipped', 'Missing recipient')
    return
  }

  if (!emailConfigured()) {
    await recordEmail(input, 'skipped', 'RESEND_API_KEY is not configured')
    return
  }

  try {
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.bodyHtml ? { bodyHtml: input.bodyHtml } : {}),
      ...(input.hideSubjectHeading ? { hideSubjectHeading: input.hideSubjectHeading } : {}),
      ...(input.previewText ? { previewText: input.previewText } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    })
    await recordEmail(input, 'sent', undefined, result.id)
  } catch (err) {
    await recordEmail(input, 'error', err instanceof Error ? err.message : 'Unknown delivery error')
  }
}

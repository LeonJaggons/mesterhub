import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './admin'
import { emailConfigured, sendEmail } from './email'
import { defaultLocale, getSupportedLocale, type Locale } from '@/lib/i18n/config'

type LifecycleEmail = {
  to?: string | null
  subject: string
  text: string
  bodyHtml?: string
  localized?: Partial<Record<Locale, {
    subject: string
    text: string
    bodyHtml?: string
    previewText?: string
  }>>
  hideSubjectHeading?: boolean
  previewText?: string
  replyTo?: string
  event: string
  requestId?: string
  locale?: Locale
  metadata?: Record<string, unknown>
}

type DeliveryStatus = 'sent' | 'skipped' | 'error'

function cleanMetadataString(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

async function preferredLocaleForUid(uid: string): Promise<Locale | null> {
  if (!uid) return null
  const snap = await adminDb.collection('users').doc(uid).get()
  if (!snap.exists) return null
  return getSupportedLocale(snap.data()?.preferredLocale as string | undefined)
}

async function resolveEmailLocale(input: LifecycleEmail): Promise<Locale> {
  if (input.locale) return input.locale

  const recipientUid = cleanMetadataString(input.metadata, 'recipientUid')
  const customerUid = cleanMetadataString(input.metadata, 'customerUid')
  const proUid = cleanMetadataString(input.metadata, 'proUid')
  const uid = recipientUid || (customerUid && !proUid ? customerUid : '') || (proUid && !customerUid ? proUid : '')

  return (await preferredLocaleForUid(uid)) ?? defaultLocale
}

async function recordEmail(input: LifecycleEmail, locale: Locale, status: DeliveryStatus, error?: string, providerId?: string) {
  const localized = input.localized?.[locale]
  await adminDb.collection('mailEvents').add({
    to: input.to ?? null,
    subject: localized?.subject ?? input.subject,
    text: localized?.text ?? input.text,
    bodyHtml: localized?.bodyHtml ?? input.bodyHtml ?? null,
    previewText: localized?.previewText ?? input.previewText ?? null,
    locale,
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
  const locale = await resolveEmailLocale(input)

  if (!input.to) {
    await recordEmail(input, locale, 'skipped', 'Missing recipient')
    return
  }

  if (!emailConfigured()) {
    await recordEmail(input, locale, 'skipped', 'RESEND_API_KEY is not configured')
    return
  }

  try {
    const localized = input.localized?.[locale]
    const result = await sendEmail({
      to: input.to,
      subject: localized?.subject ?? input.subject,
      text: localized?.text ?? input.text,
      ...(localized?.bodyHtml || input.bodyHtml ? { bodyHtml: localized?.bodyHtml ?? input.bodyHtml } : {}),
      ...(input.hideSubjectHeading ? { hideSubjectHeading: input.hideSubjectHeading } : {}),
      ...(localized?.previewText || input.previewText ? { previewText: localized?.previewText ?? input.previewText } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      locale,
    })
    await recordEmail(input, locale, 'sent', undefined, result.id)
  } catch (err) {
    await recordEmail(input, locale, 'error', err instanceof Error ? err.message : 'Unknown delivery error')
  }
}

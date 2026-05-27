import { FieldValue } from 'firebase-admin/firestore'
import { createHash } from 'crypto'
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

function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: unknown }).code
  return code === 6 || code === 'already-exists'
}

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

function emailContentForLocale(input: LifecycleEmail, locale: Locale) {
  const localized = input.localized?.[locale]
  return {
    subject: localized?.subject ?? input.subject,
    text: localized?.text ?? input.text,
    bodyHtml: localized?.bodyHtml ?? input.bodyHtml ?? null,
    previewText: localized?.previewText ?? input.previewText ?? null,
  }
}

function mailEventId(input: LifecycleEmail, locale: Locale): string {
  const content = emailContentForLocale(input, locale)
  const recipient = (input.to ?? '').trim().toLowerCase()
  const digest = createHash('sha256')
    .update(JSON.stringify({
      to: recipient,
      event: input.event,
      requestId: input.requestId ?? null,
      locale,
      subject: content.subject,
      text: content.text,
    }))
    .digest('hex')

  return `mail_${digest}`
}

function mailEventPayload(
  input: LifecycleEmail,
  locale: Locale,
  status: DeliveryStatus,
  error?: string,
  providerId?: string,
) {
  const content = emailContentForLocale(input, locale)
  return {
    to: input.to ?? null,
    subject: content.subject,
    text: content.text,
    bodyHtml: content.bodyHtml,
    previewText: content.previewText,
    locale,
    event: input.event,
    requestId: input.requestId ?? null,
    metadata: input.metadata ?? {},
    status,
    error: error ?? null,
    provider: 'resend',
    providerId: providerId ?? null,
  }
}

async function claimEmail(input: LifecycleEmail, locale: Locale, eventId: string): Promise<boolean> {
  try {
    await adminDb.collection('mailEvents').doc(eventId).create({
      ...mailEventPayload(input, locale, 'skipped'),
      status: 'sending',
      error: null,
      providerId: null,
      idempotencyKey: eventId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    return true
  } catch (err) {
    if (isAlreadyExistsError(err)) return false
    throw err
  }
}

async function recordEmail(
  input: LifecycleEmail,
  locale: Locale,
  eventId: string,
  status: DeliveryStatus,
  error?: string,
  providerId?: string,
) {
  await adminDb.collection('mailEvents').doc(eventId).set({
    ...mailEventPayload(input, locale, status, error, providerId),
    idempotencyKey: eventId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}

async function recordSkippedEmail(input: LifecycleEmail, locale: Locale, error: string) {
  await adminDb.collection('mailEvents').add({
    ...mailEventPayload(input, locale, 'skipped', error),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function sendLifecycleEmail(input: LifecycleEmail): Promise<void> {
  const locale = await resolveEmailLocale(input)

  if (!input.to) {
    await recordSkippedEmail(input, locale, 'Missing recipient')
    return
  }

  if (!emailConfigured()) {
    await recordSkippedEmail(input, locale, 'RESEND_API_KEY is not configured')
    return
  }

  const eventId = mailEventId(input, locale)
  const claimed = await claimEmail(input, locale, eventId)
  if (!claimed) return

  try {
    const localized = emailContentForLocale(input, locale)
    const result = await sendEmail({
      to: input.to,
      subject: localized.subject,
      text: localized.text,
      ...(localized.bodyHtml ? { bodyHtml: localized.bodyHtml } : {}),
      ...(input.hideSubjectHeading ? { hideSubjectHeading: input.hideSubjectHeading } : {}),
      ...(localized.previewText ? { previewText: localized.previewText } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      locale,
    })
    await recordEmail(input, locale, eventId, 'sent', undefined, result.id)
  } catch (err) {
    await recordEmail(input, locale, eventId, 'error', err instanceof Error ? err.message : 'Unknown delivery error')
  }
}

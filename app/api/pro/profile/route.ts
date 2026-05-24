import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'

const PUBLIC_FIELDS = [
  'fullName',
  'bio',
  'yearsExp',
  'pricingType',
  'hourlyRate',
  'services',
  'districts',
  'radius',
  'postcode',
  'availability',
  'paymentMethods',
] as const

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(item => cleanString(item)).filter(Boolean)
}

function cleanNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0)
}

function cleanNumber(value: unknown, fallback = 10): number {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : fallback
}

function cleanObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanSocialLinks(value: unknown) {
  const links = cleanObject(value)
  return {
    website: cleanString(links.website),
    facebook: cleanString(links.facebook),
    instagram: cleanString(links.instagram),
    linkedin: cleanString(links.linkedin),
    tiktok: cleanString(links.tiktok),
  }
}

function cleanFaqs(value: unknown) {
  const faqs = cleanObject(value)
  return {
    pricing: cleanString(faqs.pricing),
    process: cleanString(faqs.process),
    advice: cleanString(faqs.advice),
  }
}

function cleanProfileVisibility(value: unknown): 'visible' | 'paused' {
  return value === 'paused' ? 'paused' : 'visible'
}

function cleanBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function cleanNotificationPreferences(value: unknown) {
  const prefs = cleanObject(value)
  return {
    newLeads: cleanBoolean(prefs.newLeads),
    messages: cleanBoolean(prefs.messages),
    appointments: cleanBoolean(prefs.appointments),
    email: cleanBoolean(prefs.email),
    sms: cleanBoolean(prefs.sms, false),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const [profileSnap, accountSnap, verificationSnap] = await Promise.all([
      adminDb.collection('pros').doc(user.uid).get(),
      adminDb.collection('pros').doc(user.uid).collection('private').doc('account').get(),
      adminDb.collection('pros').doc(user.uid).collection('private').doc('verification').get(),
    ])

    if (!profileSnap.exists) {
      return Response.json({ error: 'Pro profile not found.' }, { status: 404 })
    }

    return Response.json({
      profile: { uid: user.uid, ...profileSnap.data() },
      account: accountSnap.exists ? accountSnap.data() : {},
      verification: verificationSnap.exists ? verificationSnap.data() : {},
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/profile GET]', err)
    return Response.json({ error: 'Could not load pro profile.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const body = await request.json()
    const profileRef = adminDb.collection('pros').doc(user.uid)
    const profileSnap = await profileRef.get()

    if (!profileSnap.exists) {
      return Response.json({ error: 'Pro profile not found.' }, { status: 404 })
    }

    const update: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }

    for (const field of PUBLIC_FIELDS) {
      if (!(field in body)) continue
      if (field === 'services' || field === 'availability' || field === 'paymentMethods') update[field] = cleanStringArray(body[field])
      else if (field === 'districts') update[field] = cleanNumberArray(body[field])
      else if (field === 'radius') update[field] = cleanNumber(body[field], profileSnap.data()?.radius ?? 10)
      else update[field] = cleanString(body[field])
    }

    if ('socialLinks' in body) update.socialLinks = cleanSocialLinks(body.socialLinks)
    if ('faqs' in body) update.faqs = cleanFaqs(body.faqs)
    if ('profileVisibility' in body) update.profileVisibility = cleanProfileVisibility(body.profileVisibility)

    if (!cleanString(update.fullName ?? profileSnap.data()?.fullName)) {
      return Response.json({ error: 'Full name is required.' }, { status: 400 })
    }

    const writes: Array<Promise<unknown>> = [profileRef.update(update)]
    const accountUpdate: Record<string, unknown> = {}
    if ('phone' in body) accountUpdate.phone = cleanString(body.phone)
    if ('notificationPreferences' in body) accountUpdate.notificationPreferences = cleanNotificationPreferences(body.notificationPreferences)
    if (Object.keys(accountUpdate).length > 0) {
      writes.push(
        adminDb.collection('pros').doc(user.uid).collection('private').doc('account').set({
          ...accountUpdate,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true })
      )
    }

    await Promise.all(writes)

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/profile PATCH]', err)
    return Response.json({ error: 'Could not save pro profile.' }, { status: 500 })
  }
}

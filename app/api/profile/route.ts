import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { isLocale } from '@/lib/i18n/config'
import { enforceUserRateLimit } from '@/lib/rateLimit'

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = displayName.trim().split(/\s+/).filter(Boolean)
  return { firstName, lastName: rest.join(' ') }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const snap = await adminDb.collection('users').doc(user.uid).get()
    return Response.json({
      profile: {
        uid: user.uid,
        email: user.email ?? '',
        emailVerified: Boolean(user.email_verified),
        displayName: user.name ?? '',
        ...(snap.exists ? snap.data() : {}),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/profile GET]', err)
    return Response.json({ error: 'Could not load profile.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const body = await request.json()
    const requestedDisplayName = cleanString(body.displayName, user.name ?? '')
    const requestedParts = splitDisplayName(requestedDisplayName)
    const firstName = cleanString(body.firstName, requestedParts.firstName)
    const lastName = cleanString(body.lastName, requestedParts.lastName)
    const displayName = cleanString(body.displayName, [firstName, lastName].filter(Boolean).join(' '))
    const verifiedPhone = typeof user.phone_number === 'string' ? user.phone_number : ''
    const phone = verifiedPhone || cleanString(body.phone)
    const preferredDistrict = cleanString(body.preferredDistrict)
    const preferredLocale = cleanString(body.preferredLocale)
    const address = cleanString(body.address)

    if (!displayName) {
      return Response.json({ error: 'Display name is required.' }, { status: 400 })
    }

    await Promise.all([
      adminAuth.updateUser(user.uid, { displayName }),
      adminDb.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email ?? '',
        emailVerified: Boolean(user.email_verified),
        displayName,
        firstName,
        lastName,
        phone,
        phoneVerified: Boolean(verifiedPhone),
        preferredDistrict,
        ...(isLocale(preferredLocale) ? { preferredLocale } : {}),
        address,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true }),
    ])

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/profile PATCH]', err)
    return Response.json({ error: 'Could not save profile.' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { isLocale } from '@/lib/i18n/config'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const body = await request.json().catch(() => null)
    const preferredLocale = typeof body?.preferredLocale === 'string' ? body.preferredLocale.trim() : ''

    if (!isLocale(preferredLocale)) {
      return Response.json({ error: 'Unsupported language.' }, { status: 400 })
    }

    await adminDb.collection('users').doc(user.uid).set({
      uid: user.uid,
      email: user.email ?? '',
      emailVerified: Boolean(user.email_verified),
      displayName: user.name ?? '',
      preferredLocale,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return Response.json({ ok: true, preferredLocale })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/me/locale PATCH]', err)
    return Response.json({ error: 'Could not save language preference.' }, { status: 500 })
  }
}

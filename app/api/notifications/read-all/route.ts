import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireUser } from '@/firebase/adminAccess'
import { adminDb } from '@/firebase/admin'
import { notificationItemsRef } from '@/firebase/inAppNotifications'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const unreadSnap = await notificationItemsRef(user.uid)
      .where('readAt', '==', null)
      .limit(100)
      .get()

    if (!unreadSnap.empty) {
      const batch = adminDb.batch()
      unreadSnap.docs.forEach(doc => {
        batch.update(doc.ref, { readAt: FieldValue.serverTimestamp() })
      })
      await batch.commit()
    }

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/notifications/read-all PATCH]', err)
    return Response.json({ error: 'Could not mark notifications as read.' }, { status: 500 })
  }
}

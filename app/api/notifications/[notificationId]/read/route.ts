import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireUser } from '@/firebase/adminAccess'
import { notificationItemsRef } from '@/firebase/inAppNotifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const user = await requireUser(request)
    const { notificationId } = await params
    await notificationItemsRef(user.uid).doc(notificationId).update({
      readAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/notifications/[notificationId]/read PATCH]', err)
    return Response.json({ error: 'Could not mark notification as read.' }, { status: 500 })
  }
}


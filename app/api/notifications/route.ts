import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { notificationItemsRef, serializeNotification } from '@/firebase/inAppNotifications'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const snap = await notificationItemsRef(user.uid)
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get()

    const notifications = snap.docs.map(serializeNotification)
    const unreadCount = notifications.filter(notification => !notification.readAt).length

    return Response.json({ notifications, unreadCount })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/notifications GET]', err)
    return Response.json({ error: 'Could not load notifications.' }, { status: 500 })
  }
}


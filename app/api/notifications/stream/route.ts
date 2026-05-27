import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { notificationItemsRef, serializeNotification } from '@/firebase/inAppNotifications'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      start(controller) {
        const query = notificationItemsRef(user.uid)
          .orderBy('createdAt', 'desc')
          .limit(30)

        const unsubscribe = query.onSnapshot(
          snapshot => {
            const notifications = snapshot.docs.map(serializeNotification)
            const unreadCount = notifications.filter(notification => !notification.readAt).length
            controller.enqueue(encoder.encode(`${JSON.stringify({ notifications, unreadCount })}\n`))
          },
          error => {
            controller.error(error)
          },
        )

        request.signal.addEventListener('abort', () => {
          unsubscribe()
          controller.close()
        })
      },
    })

    return new Response(stream, {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/notifications/stream GET]', err)
    return Response.json({ error: 'Could not stream notifications.' }, { status: 500 })
  }
}


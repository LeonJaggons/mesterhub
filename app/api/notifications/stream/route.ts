import { NextRequest } from 'next/server'
import { requireUser } from '@/firebase/adminAccess'
import { notificationItemsRef, serializeNotification } from '@/firebase/inAppNotifications'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STREAM_KEEPALIVE_MS = 25_000
const STREAM_MAX_AGE_MS = 55_000

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const encoder = new TextEncoder()
    let cleanup = () => {}

    const stream = new ReadableStream({
      start(controller) {
        let closed = false
        let unsubscribe = () => {}
        const timers: {
          keepalive?: ReturnType<typeof setInterval>
          timeout?: ReturnType<typeof setTimeout>
        } = {}
        const query = notificationItemsRef(user.uid)
          .orderBy('createdAt', 'desc')
          .limit(30)

        const close = (closeController = true) => {
          if (closed) return
          closed = true
          if (timers.keepalive) clearInterval(timers.keepalive)
          if (timers.timeout) clearTimeout(timers.timeout)
          unsubscribe()
          request.signal.removeEventListener('abort', onAbort)
          if (!closeController) return
          try {
            controller.close()
          } catch {
            // The stream may already be closed by the runtime.
          }
        }
        const onAbort = () => close()
        cleanup = () => close(false)

        unsubscribe = query.onSnapshot(
          snapshot => {
            if (closed) return
            const notifications = snapshot.docs.map(serializeNotification)
            const unreadCount = notifications.filter(notification => !notification.readAt).length
            controller.enqueue(encoder.encode(`${JSON.stringify({ notifications, unreadCount })}\n`))
          },
          error => {
            closed = true
            if (timers.keepalive) clearInterval(timers.keepalive)
            if (timers.timeout) clearTimeout(timers.timeout)
            unsubscribe()
            request.signal.removeEventListener('abort', onAbort)
            controller.error(error)
          },
        )

        timers.keepalive = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode('\n'))
        }, STREAM_KEEPALIVE_MS)
        timers.timeout = setTimeout(close, STREAM_MAX_AGE_MS)

        request.signal.addEventListener('abort', onAbort)
      },
      cancel() {
        cleanup()
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


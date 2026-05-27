import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { getProServiceRequest } from '@/lib/proServiceRequests'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const role = request.nextUrl.searchParams.get('role') === 'pro' ? 'pro' : 'customer'
    const { requestId } = await params
    const convSnap = await adminDb.collection('conversations').doc(requestId).get()

    if (!convSnap.exists) {
      return Response.json({ conversation: null, request: null, messages: [] }, { status: 404 })
    }

    const conversation = convSnap.data()!
    if (conversation.customerUid !== user.uid && conversation.proUid !== user.uid) {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }

    const messagesSnap = await adminDb
      .collection('conversations')
      .doc(requestId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get()

    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    let serviceRequest: Record<string, unknown> | null = null

    if (role === 'pro') {
      const proRequest = await getProServiceRequest(user.uid, requestId)
      serviceRequest = proRequest && !proRequest.obfuscated ? proRequest : null
    } else {
      const requestSnap = await adminDb.collection('serviceRequests').doc(requestId).get()
      if (requestSnap.exists && requestSnap.data()?.customerUid === user.uid) {
        serviceRequest = { id: requestSnap.id, ...requestSnap.data() }
      }
    }

    let partnerAvatarUrl: string | null = null
    if (role === 'customer' && typeof conversation.proUid === 'string') {
      const proSnap = await adminDb.collection('pros').doc(conversation.proUid).get()
      partnerAvatarUrl = proSnap.exists ? ((proSnap.data()?.avatarUrl as string | null) ?? null) : null
    }

    return Response.json({
      conversation,
      request: serviceRequest,
      messages,
      partnerAvatarUrl,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/conversations/[requestId] GET]', err)
    return Response.json({ error: 'Could not load conversation.' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { enforceUserRateLimit } from '@/lib/rateLimit'

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const timestamp = value as { toMillis?: () => number }
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : 0
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const role = request.nextUrl.searchParams.get('role') === 'pro' ? 'pro' : 'customer'
    const filterField = role === 'pro' ? 'proUid' : 'customerUid'
    const snap = await adminDb.collection('conversations').where(filterField, '==', user.uid).get()

    const conversations = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
      .filter(row => role !== 'customer' || !('customerDeletedAt' in row))
      .sort((a, b) => {
        return timestampMillis(b.lastMessageAt) - timestampMillis(a.lastMessageAt)
      })

    if (role === 'customer') {
      const proUids = [...new Set(conversations.map(row => row.proUid).filter((uid): uid is string => typeof uid === 'string'))]
      const proSnaps = await Promise.all(proUids.map(uid => adminDb.collection('pros').doc(uid).get()))
      const avatarMap = new Map(
        proSnaps
          .filter(proSnap => proSnap.exists)
          .map(proSnap => [proSnap.id, (proSnap.data()?.avatarUrl as string | null) ?? null]),
      )
      return Response.json({
        conversations: conversations.map(row => ({
          ...row,
          proAvatarUrl: typeof row.proUid === 'string' ? (avatarMap.get(row.proUid) ?? null) : null,
        })),
      })
    }

    return Response.json({ conversations })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/conversations GET]', err)
    return Response.json({ error: 'Could not load conversations.' }, { status: 500 })
  }
}

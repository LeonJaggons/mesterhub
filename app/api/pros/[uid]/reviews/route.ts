import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { serializeDoc } from '@/app/api/admin/utils'
import { hasPaidProFeatures } from '@/lib/billing'
import { enforceIpRateLimit } from '@/lib/rateLimit'

type SerializedReview = ReturnType<typeof serializeReview>

function serializeReview(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = serializeDoc(doc)
  return {
    id: data.id,
    requestId: data.requestId,
    proUid: data.proUid,
    customerName: data.customerName,
    categoryName: data.categoryName,
    rating: data.rating,
    comment: data.comment,
    createdAt: data.createdAt,
  }
}

function reviewTime(review: SerializedReview): number {
  return typeof review.createdAt === 'string' ? new Date(review.createdAt).getTime() || 0 : 0
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const limited = await enforceIpRateLimit('publicRead', request)
    if (limited) return limited

    const { uid } = await params
    const proSnap = await adminDb.collection('pros').doc(uid).get()
    if (!proSnap.exists) {
      return Response.json({ reviews: [] }, { status: 404 })
    }
    const pro = proSnap.data()
    if (!hasPaidProFeatures(pro?.subscriptionStatus, pro?.subscriptionCurrentPeriodEnd)) {
      return Response.json({ reviews: [] })
    }

    const snap = await adminDb
      .collection('reviews')
      .where('proUid', '==', uid)
      .limit(50)
      .get()

    const reviews = snap.docs
      .filter(doc => doc.data().status === 'published')
      .map(serializeReview)
      .sort((a, b) => reviewTime(b) - reviewTime(a))
      .slice(0, 20)

    return Response.json({ reviews })
  } catch (err) {
    console.error('[/api/pros/[uid]/reviews GET]', err)
    return Response.json({ reviews: [], error: 'Could not load reviews.' }, { status: 500 })
  }
}

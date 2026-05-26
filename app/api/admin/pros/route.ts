import { NextRequest } from 'next/server'
import { FieldPath } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'

const PAGE_SIZE = 50

function cleanStatus(value: string | null): string {
  return value && ['pending_verification', 'active', 'suspended', 'rejected'].includes(value)
    ? value
    : 'pending_verification'
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const status = cleanStatus(request.nextUrl.searchParams.get('status'))
    const cursor = request.nextUrl.searchParams.get('cursor')?.trim() ?? ''
    let query = adminDb
      .collection('pros')
      .where('status', '==', status)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE + 1)

    if (cursor) {
      query = query.startAfter(cursor)
    }

    const snap = await query.get()
    const pageDocs = snap.docs.slice(0, PAGE_SIZE)
    const hasMore = snap.docs.length > PAGE_SIZE

    const pros = await Promise.all(pageDocs.map(async docSnap => {
      const [accountSnap, verificationSnap] = await Promise.all([
        docSnap.ref.collection('private').doc('account').get(),
        docSnap.ref.collection('private').doc('verification').get(),
      ])

      return {
        uid: docSnap.id,
        ...docSnap.data(),
        account: accountSnap.exists ? accountSnap.data() : {},
        verification: verificationSnap.exists ? verificationSnap.data() : {},
      }
    }))

    return Response.json({
      pros,
      pageSize: PAGE_SIZE,
      hasMore,
      nextCursor: hasMore ? pageDocs.at(-1)?.id ?? null : null,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/pros GET]', err)
    return Response.json({ error: 'Could not load pros.' }, { status: 500 })
  }
}

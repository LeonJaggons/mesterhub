import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { serializeDoc } from '../utils'

const statuses = ['pending', 'quoted', 'accepted', 'declined', 'completed', 'cancelled'] as const

function cleanStatus(value: string | null): string | null {
  return value && statuses.includes(value as typeof statuses[number]) ? value : null
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const status = cleanStatus(request.nextUrl.searchParams.get('status'))
    const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
    let query: FirebaseFirestore.Query = adminDb.collection('serviceRequests')

    if (status) query = query.where('status', '==', status)

    const snap = await query.orderBy('createdAt', 'desc').limit(100).get()
    const serviceRequests = snap.docs
      .map(serializeDoc)
      .filter(item => {
        if (!q) return true
        const haystack = [
          item.id,
          item.proName,
          item.customerName,
          item.customerEmail,
          item.categoryName,
          item.proUid,
          item.customerUid,
        ].join(' ').toLowerCase()
        return haystack.includes(q)
      })

    return Response.json({ serviceRequests })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/requests GET]', err)
    return Response.json({ error: 'Could not load service requests.' }, { status: 500 })
  }
}

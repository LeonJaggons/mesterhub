import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { serializeDoc } from '../utils'

const statuses = ['new', 'reviewing', 'planned', 'resolved', 'closed'] as const

function cleanStatus(value: string | null): string | null {
  return value && statuses.includes(value as typeof statuses[number]) ? value : null
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const status = cleanStatus(request.nextUrl.searchParams.get('status'))
    const type = request.nextUrl.searchParams.get('type')?.trim()
    let query: FirebaseFirestore.Query = adminDb.collection('feedback')

    if (status) query = query.where('status', '==', status)
    if (type && ['problem', 'feature', 'general'].includes(type)) query = query.where('type', '==', type)

    const snap = await query.orderBy('createdAt', 'desc').limit(100).get()
    return Response.json({ feedback: snap.docs.map(serializeDoc) })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/feedback GET]', err)
    return Response.json({ error: 'Could not load feedback.' }, { status: 500 })
  }
}

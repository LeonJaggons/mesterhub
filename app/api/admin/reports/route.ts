import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { serializeDoc } from '../utils'

const statuses = ['new', 'reviewing', 'action_taken', 'resolved', 'dismissed'] as const
const targetRoles = ['pro', 'customer', 'user'] as const

function cleanFilter<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value && allowed.includes(value as T) ? value as T : null
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const status = cleanFilter(request.nextUrl.searchParams.get('status'), statuses)
    const targetRole = cleanFilter(request.nextUrl.searchParams.get('targetRole'), targetRoles)

    const snap = await adminDb.collection('reports').orderBy('createdAt', 'desc').limit(100).get()
    const reports = snap.docs
      .map(serializeDoc)
      .filter(report => !status || report.status === status)
      .filter(report => !targetRole || report.targetRole === targetRole)

    return Response.json({ reports })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/reports GET]', err)
    return Response.json({ error: 'Could not load reports.' }, { status: 500 })
  }
}

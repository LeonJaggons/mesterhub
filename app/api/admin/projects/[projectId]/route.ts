import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { cleanString } from '../../utils'

const statuses = ['active', 'closed', 'cancelled'] as const
type ProjectStatus = typeof statuses[number]

function cleanStatus(value: unknown): ProjectStatus | null {
  return statuses.includes(value as ProjectStatus) ? value as ProjectStatus : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const admin = await requireAdmin(request)
    const { projectId } = await params
    const body = await request.json()
    const status = cleanStatus(body.status)
    const reason = cleanString(body.reason)

    if (!status) {
      return Response.json({ error: 'Unknown project status.' }, { status: 400 })
    }

    const ref = adminDb.collection('projects').doc(projectId)
    const snap = await ref.get()
    if (!snap.exists) {
      return Response.json({ error: 'Project not found.' }, { status: 404 })
    }

    await ref.update({
      status,
      adminReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
      adminAction: {
        status,
        reason,
        actedBy: admin.uid,
        actedByEmail: admin.email ?? null,
        actedAt: FieldValue.serverTimestamp(),
      },
    })

    return Response.json({ ok: true, status })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/projects/[projectId] PATCH]', err)
    return Response.json({ error: 'Could not update project.' }, { status: 500 })
  }
}

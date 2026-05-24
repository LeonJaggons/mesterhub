import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { cleanString } from '../../utils'

const statuses = ['new', 'reviewing', 'planned', 'resolved', 'closed'] as const
type FeedbackStatus = typeof statuses[number]

function cleanStatus(value: unknown): FeedbackStatus | null {
  return statuses.includes(value as FeedbackStatus) ? value as FeedbackStatus : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> },
) {
  try {
    const admin = await requireAdmin(request)
    const { feedbackId } = await params
    const body = await request.json()
    const status = cleanStatus(body.status)
    const note = cleanString(body.note)

    if (!status) {
      return Response.json({ error: 'Unknown feedback status.' }, { status: 400 })
    }

    const ref = adminDb.collection('feedback').doc(feedbackId)
    const snap = await ref.get()
    if (!snap.exists) {
      return Response.json({ error: 'Feedback not found.' }, { status: 404 })
    }

    await ref.update({
      status,
      adminNote: note,
      updatedAt: FieldValue.serverTimestamp(),
      reviewedBy: admin.uid,
      reviewedByEmail: admin.email ?? null,
    })

    return Response.json({ ok: true, status })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/feedback/[feedbackId] PATCH]', err)
    return Response.json({ error: 'Could not update feedback.' }, { status: 500 })
  }
}

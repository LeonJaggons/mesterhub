import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { sendLifecycleEmail } from '@/firebase/notifications'

type ProStatus = 'active' | 'suspended' | 'rejected'

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function statusFromAction(action: string): ProStatus | null {
  if (action === 'approve') return 'active'
  if (action === 'suspend') return 'suspended'
  if (action === 'reject') return 'rejected'
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const admin = await requireAdmin(request)
    const { uid } = await params
    const body = await request.json()
    const status = statusFromAction(cleanString(body.action))
    const reason = cleanString(body.reason)

    if (!status) {
      return Response.json({ error: 'Unknown admin action.' }, { status: 400 })
    }

    const proRef = adminDb.collection('pros').doc(uid)
    const accountRef = proRef.collection('private').doc('account')
    const verificationRef = proRef.collection('private').doc('verification')
    const [proSnap, accountSnap] = await Promise.all([proRef.get(), accountRef.get()])

    if (!proSnap.exists) {
      return Response.json({ error: 'Pro not found.' }, { status: 404 })
    }

    const batch = adminDb.batch()
    const review = {
      reviewedBy: admin.uid,
      reviewedByEmail: admin.email ?? null,
      reviewedAt: FieldValue.serverTimestamp(),
      reason,
    }

    batch.update(proRef, {
      status,
      verificationStatus: status,
      verificationReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
      adminReview: review,
    })
    batch.set(verificationRef, {
      status,
      ...review,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    await batch.commit()

    const email = accountSnap.exists ? cleanString(accountSnap.data()?.email) : ''
    await sendLifecycleEmail({
      to: email,
      event: `pro.${status}`,
      subject: status === 'active' ? 'Your Mestermind profile is live' : 'Your Mestermind verification status changed',
      text: status === 'active'
        ? 'Your pro profile has been approved and is now visible to customers.'
        : `Your pro profile status is now ${status}.${reason ? ` Reason: ${reason}` : ''}`,
      metadata: { proUid: uid, status },
    })

    return Response.json({ ok: true, status })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/pros/[uid] PATCH]', err)
    return Response.json({ error: 'Could not update pro.' }, { status: 500 })
  }
}

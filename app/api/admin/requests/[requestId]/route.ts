import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { sendLifecycleEmail } from '@/firebase/notifications'
import { cleanString } from '../../utils'
import { huCategory } from '@/lib/i18n/email'

type RequestDoc = {
  proUid?: string
  customerUid?: string
  proName?: string
  customerName?: string
  customerEmail?: string
  categoryName?: string
  status?: string
}

function canCancel(status?: string): boolean {
  return status === 'pending' || status === 'quoted' || status === 'accepted'
}

async function proEmail(proUid?: string): Promise<string> {
  if (!proUid) return ''
  const snap = await adminDb.collection('pros').doc(proUid).collection('private').doc('account').get()
  const email = snap.data()?.email
  return typeof email === 'string' ? email.trim() : ''
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const admin = await requireAdmin(request)
    const { requestId } = await params
    const body = await request.json()
    const action = cleanString(body.action)
    const reason = cleanString(body.reason)

    if (action !== 'cancel') {
      return Response.json({ error: 'Unknown request action.' }, { status: 400 })
    }

    const ref = adminDb.collection('serviceRequests').doc(requestId)
    const snap = await ref.get()
    if (!snap.exists) {
      return Response.json({ error: 'Request not found.' }, { status: 404 })
    }

    const serviceRequest = snap.data() as RequestDoc
    if (!canCancel(serviceRequest.status)) {
      return Response.json({ error: 'This request can no longer be cancelled.' }, { status: 409 })
    }

    await ref.update({
      status: 'cancelled',
      cancelledBy: 'admin',
      cancelReason: reason,
      cancelledAt: FieldValue.serverTimestamp(),
      adminAction: {
        action,
        reason,
        actedBy: admin.uid,
        actedByEmail: admin.email ?? null,
        actedAt: FieldValue.serverTimestamp(),
      },
      statusHistory: FieldValue.arrayUnion({
        status: 'cancelled',
        actorUid: admin.uid,
        actorRole: 'admin',
        at: new Date(),
      }),
    })
    const categoryNameHu = huCategory(serviceRequest.categoryName ?? 'Service')

    await Promise.all([
      sendLifecycleEmail({
        to: serviceRequest.customerEmail,
        event: 'request.cancelled_by_admin',
        requestId,
        subject: `${serviceRequest.categoryName ?? 'Service'} request cancelled`,
        text: `Mestermind cancelled this request.${reason ? ` Reason: ${reason}` : ''}`,
        localized: {
          hu: {
            subject: `${categoryNameHu} kérés törölve`,
            text: `A Mestermind törölte ezt a kérést.${reason ? ` Indok: ${reason}` : ''}`,
          },
        },
        metadata: { recipientUid: serviceRequest.customerUid, cancelledBy: 'admin', proUid: serviceRequest.proUid, customerUid: serviceRequest.customerUid },
      }),
      sendLifecycleEmail({
        to: await proEmail(serviceRequest.proUid),
        event: 'request.cancelled_by_admin',
        requestId,
        subject: `${serviceRequest.categoryName ?? 'Service'} request cancelled`,
        text: `Mestermind cancelled this request.${reason ? ` Reason: ${reason}` : ''}`,
        localized: {
          hu: {
            subject: `${categoryNameHu} kérés törölve`,
            text: `A Mestermind törölte ezt a kérést.${reason ? ` Indok: ${reason}` : ''}`,
          },
        },
        metadata: { recipientUid: serviceRequest.proUid, cancelledBy: 'admin', proUid: serviceRequest.proUid, customerUid: serviceRequest.customerUid },
      }),
    ])

    return Response.json({ ok: true, status: 'cancelled' })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/requests/[requestId] PATCH]', err)
    return Response.json({ error: 'Could not update request.' }, { status: 500 })
  }
}

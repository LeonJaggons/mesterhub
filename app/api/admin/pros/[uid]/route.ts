import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { sendLifecycleEmail } from '@/firebase/notifications'
import { huStatus } from '@/lib/i18n/email'
import { markProReferralApproved } from '@/lib/referrals'
import {
  deleteAuthUser,
  deleteDocumentTree,
  deleteQueryResults,
  deleteStoragePrefix,
  FirestoreWriteQueue,
} from '../../deleteUtils'

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
    if (status === 'active') {
      await markProReferralApproved(uid)
    }

    const email = accountSnap.exists ? cleanString(accountSnap.data()?.email) : ''
    await sendLifecycleEmail({
      to: email,
      event: `pro.${status}`,
      subject: status === 'active' ? 'Your Mestermind profile is live' : 'Your Mestermind verification status changed',
      text: status === 'active'
        ? 'Your pro profile has been approved and is now visible to customers.'
        : `Your pro profile status is now ${status}.${reason ? ` Reason: ${reason}` : ''}`,
      localized: {
        hu: {
          subject: status === 'active' ? 'A Mestermind profilod élő' : 'Megváltozott a Mestermind ellenőrzési státuszod',
          text: status === 'active'
            ? 'A szakember profilodat jóváhagytuk, és mostantól látható az ügyfelek számára.'
            : `A szakember profilod státusza most: ${huStatus(status)}.${reason ? ` Indok: ${reason}` : ''}`,
        },
      },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await requireAdmin(request)
    const { uid } = await params
    const proRef = adminDb.collection('pros').doc(uid)
    const proSnap = await proRef.get()

    if (!proSnap.exists) {
      return Response.json({ error: 'Pro not found.' }, { status: 404 })
    }

    const queue = new FirestoreWriteQueue()
    const seen = new Set<string>()
    const counts = {
      serviceRequests: 0,
      conversations: 0,
      marketplaceQuotes: 0,
      reviews: 0,
      messageDigests: 0,
      notifications: 0,
      reports: 0,
      mailEvents: 0,
      projectsUpdated: 0,
    }

    counts.serviceRequests += await deleteQueryResults(
      adminDb.collection('serviceRequests').where('proUid', '==', uid),
      queue,
      seen,
    )
    counts.conversations += await deleteQueryResults(
      adminDb.collection('conversations').where('proUid', '==', uid),
      queue,
      seen,
    )
    counts.marketplaceQuotes += await deleteQueryResults(
      adminDb.collection('marketplaceQuotes').where('proUid', '==', uid),
      queue,
      seen,
    )
    counts.reviews += await deleteQueryResults(
      adminDb.collection('reviews').where('proUid', '==', uid),
      queue,
      seen,
    )
    counts.messageDigests += await deleteQueryResults(
      adminDb.collection('messageDigests').where('proUid', '==', uid),
      queue,
      seen,
    )
    counts.messageDigests += await deleteQueryResults(
      adminDb.collection('messageDigests').where('recipientUid', '==', uid),
      queue,
      seen,
    )
    counts.notifications += await deleteQueryResults(
      adminDb.collectionGroup('items').where('actorUid', '==', uid),
      queue,
      seen,
    )
    counts.notifications += await deleteQueryResults(
      adminDb.collectionGroup('items').where('recipientUid', '==', uid),
      queue,
      seen,
    )
    counts.reports += await deleteQueryResults(
      adminDb.collection('reports').where('targetUid', '==', uid),
      queue,
      seen,
    )
    counts.reports += await deleteQueryResults(
      adminDb.collection('reports').where('reporterUid', '==', uid),
      queue,
      seen,
    )
    counts.reports += await deleteQueryResults(
      adminDb.collection('reports').where('requestContext.proUid', '==', uid),
      queue,
      seen,
    )
    counts.mailEvents += await deleteQueryResults(
      adminDb.collection('mailEvents').where('metadata.proUid', '==', uid),
      queue,
      seen,
    )

    const invitedProjectsSnap = await adminDb
      .collection('projects')
      .where('invitedProUids', 'array-contains', uid)
      .get()
    for (const doc of invitedProjectsSnap.docs) {
      await queue.update(doc.ref, {
        invitedProUids: FieldValue.arrayRemove(uid),
        updatedAt: FieldValue.serverTimestamp(),
      })
      counts.projectsUpdated += 1
    }

    await deleteDocumentTree(adminDb.collection('notifications').doc(uid), queue, seen)
    await deleteDocumentTree(adminDb.collection('users').doc(uid), queue, seen)
    await deleteDocumentTree(proRef, queue, seen)
    await queue.commit()

    await Promise.all([
      deleteStoragePrefix(`pros/${uid}/`).catch(err => {
        console.error('[/api/admin/pros/[uid] DELETE] storage cleanup failed', err)
      }),
      deleteAuthUser(uid),
    ])

    return Response.json({
      ok: true,
      deletedDocuments: queue.deleted,
      updatedDocuments: queue.updated,
      counts,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/pros/[uid] DELETE]', err)
    return Response.json({ error: 'Could not delete pro.' }, { status: 500 })
  }
}

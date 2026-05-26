import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import {
  deleteAuthUser,
  deleteDocumentTree,
  deleteQueryResults,
  deleteStoragePrefix,
  FirestoreWriteQueue,
} from '../../deleteUtils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    await requireAdmin(request)
    const { uid } = await params
    const [userSnap, proSnap] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('pros').doc(uid).get(),
    ])

    if (proSnap.exists) {
      return Response.json({ error: 'This user has a pro profile. Delete them from the Pros admin page.' }, { status: 409 })
    }

    const queue = new FirestoreWriteQueue()
    const seen = new Set<string>()
    const counts = {
      projects: 0,
      serviceRequests: 0,
      conversations: 0,
      marketplaceQuotes: 0,
      reviews: 0,
      feedback: 0,
      messageDigests: 0,
      notifications: 0,
      reports: 0,
      mailEvents: 0,
    }

    counts.projects += await deleteQueryResults(
      adminDb.collection('projects').where('customerUid', '==', uid),
      queue,
      seen,
    )
    counts.serviceRequests += await deleteQueryResults(
      adminDb.collection('serviceRequests').where('customerUid', '==', uid),
      queue,
      seen,
    )
    counts.conversations += await deleteQueryResults(
      adminDb.collection('conversations').where('customerUid', '==', uid),
      queue,
      seen,
    )
    counts.marketplaceQuotes += await deleteQueryResults(
      adminDb.collection('marketplaceQuotes').where('customerUid', '==', uid),
      queue,
      seen,
    )
    counts.reviews += await deleteQueryResults(
      adminDb.collection('reviews').where('customerUid', '==', uid),
      queue,
      seen,
    )
    counts.feedback += await deleteQueryResults(
      adminDb.collection('feedback').where('userUid', '==', uid),
      queue,
      seen,
    )
    counts.messageDigests += await deleteQueryResults(
      adminDb.collection('messageDigests').where('customerUid', '==', uid),
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
      adminDb.collection('reports').where('requestContext.customerUid', '==', uid),
      queue,
      seen,
    )
    counts.mailEvents += await deleteQueryResults(
      adminDb.collection('mailEvents').where('metadata.customerUid', '==', uid),
      queue,
      seen,
    )
    counts.mailEvents += await deleteQueryResults(
      adminDb.collection('mailEvents').where('metadata.userUid', '==', uid),
      queue,
      seen,
    )

    await deleteDocumentTree(adminDb.collection('notifications').doc(uid), queue, seen)
    if (userSnap.exists) {
      await deleteDocumentTree(userSnap.ref, queue, seen)
    }
    await queue.commit()

    await Promise.all([
      deleteStoragePrefix(`users/${uid}/`).catch(err => {
        console.error('[/api/admin/users/[uid] DELETE] storage cleanup failed', err)
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
    console.error('[/api/admin/users/[uid] DELETE]', err)
    return Response.json({ error: 'Could not delete user.' }, { status: 500 })
  }
}

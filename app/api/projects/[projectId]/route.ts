import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { sendLifecycleEmail } from '@/firebase/notifications'

type ProjectDoc = {
  customerUid: string
  status?: 'active' | 'closed' | 'cancelled'
}

type RequestDoc = {
  id: string
  proUid: string
  customerUid: string
  categoryName: string
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  appointmentRequest?: unknown
  appointmentChangeRequest?: unknown
}

function canCancel(status: RequestDoc['status']): boolean {
  return status === 'pending' || status === 'quoted' || status === 'accepted'
}

function hasAppointment(req: RequestDoc): boolean {
  return Boolean(req.appointmentRequest || req.appointmentChangeRequest)
}

function historyEntry(status: string, actorUid: string, actorRole: 'customer' | 'pro') {
  return {
    status,
    actorUid,
    actorRole,
    at: new Date(),
  }
}

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function proEmail(proUid: string): Promise<string> {
  const snap = await adminDb.collection('pros').doc(proUid).collection('private').doc('account').get()
  return cleanString(snap.data()?.email)
}

function cancellationText(categoryName: string, requestUrl: string): string {
  return [
    `The ${categoryName} request was cancelled because the customer deleted the project.`,
    `Open Mestermind to review the cancelled request: ${requestUrl}`,
  ].join('\n\n')
}

function cancellationHtml(categoryName: string, requestUrl: string): string {
  return `
    <p>The ${escapeEmailHtml(categoryName)} request was cancelled because the customer deleted the project.</p>
    <p><a href="${escapeEmailHtml(requestUrl)}">Review the cancelled request</a></p>
  `
}

function cancellationTextHu(categoryName: string, requestUrl: string): string {
  return [
    `A(z) ${categoryName} kérés törölve lett, mert az ügyfél törölte a projektet.`,
    `Nyisd meg a Mestermindet a törölt kérés áttekintéséhez: ${requestUrl}`,
  ].join('\n\n')
}

function cancellationHtmlHu(categoryName: string, requestUrl: string): string {
  return `
    <p>A(z) ${escapeEmailHtml(categoryName)} kérés törölve lett, mert az ügyfél törölte a projektet.</p>
    <p><a href="${escapeEmailHtml(requestUrl)}">Törölt kérés áttekintése</a></p>
  `
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser(request)
    const { projectId } = await params
    const projectRef = adminDb.collection('projects').doc(projectId)
    const projectSnap = await projectRef.get()

    if (!projectSnap.exists) {
      return Response.json({ error: 'Project not found.' }, { status: 404 })
    }

    const project = projectSnap.data() as ProjectDoc
    if (project.customerUid !== user.uid) {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }

    const requestsSnap = await adminDb
      .collection('serviceRequests')
      .where('projectId', '==', projectId)
      .where('customerUid', '==', user.uid)
      .get()

    const linkedRequests = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestDoc))
    if (linkedRequests.some(req => req.status === 'completed')) {
      return Response.json({ error: 'Projects with completed jobs cannot be deleted.' }, { status: 409 })
    }
    if (linkedRequests.some(hasAppointment)) {
      return Response.json({ error: 'Projects with appointments cannot be deleted.' }, { status: 409 })
    }

    const batch = adminDb.batch()
    const reason = 'Project deleted by customer.'

    batch.update(projectRef, {
      status: 'cancelled',
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: user.uid,
      updatedAt: FieldValue.serverTimestamp(),
    })

    for (const req of linkedRequests) {
      const update: Record<string, unknown> = {
        customerDeletedAt: FieldValue.serverTimestamp(),
        customerDeletedBy: user.uid,
        customerDeletedViaProject: projectId,
      }

      if (canCancel(req.status)) {
        update.status = 'cancelled'
        update.cancelledBy = 'customer'
        update.cancelReason = reason
        update.cancelledAt = FieldValue.serverTimestamp()
        update.statusHistory = FieldValue.arrayUnion(historyEntry('cancelled', user.uid, 'customer'))
      }

      batch.update(adminDb.collection('serviceRequests').doc(req.id), update)
      batch.delete(adminDb.collection('messageDigests').doc(`${req.id}_${user.uid}`))

      const convRef = adminDb.collection('conversations').doc(req.id)
      const convSnap = await convRef.get()
      if (convSnap.exists) {
        batch.update(convRef, {
          customerDeletedAt: FieldValue.serverTimestamp(),
          customerDeletedBy: user.uid,
        })
      }
    }

    await batch.commit()

    await Promise.all(
      linkedRequests
        .filter(req => canCancel(req.status))
        .map(async req => {
          const requestUrl = appUrl(`/pro/jobs/${req.id}`)
          await sendLifecycleEmail({
            to: await proEmail(req.proUid),
            event: 'request.cancelled',
            requestId: req.id,
            subject: `${req.categoryName} request cancelled`,
            previewText: `The ${req.categoryName} request was cancelled because the customer deleted the project.`,
            text: cancellationText(req.categoryName, requestUrl),
            bodyHtml: cancellationHtml(req.categoryName, requestUrl),
            localized: {
              hu: {
                subject: `${req.categoryName} kérés törölve`,
                previewText: `A(z) ${req.categoryName} kérés törölve lett, mert az ügyfél törölte a projektet.`,
                text: cancellationTextHu(req.categoryName, requestUrl),
                bodyHtml: cancellationHtmlHu(req.categoryName, requestUrl),
              },
            },
            hideSubjectHeading: true,
            metadata: {
              recipientUid: req.proUid,
              proUid: req.proUid,
              customerUid: req.customerUid,
              projectId,
              cancelledBy: 'customer',
              deletedByCustomer: true,
            },
          })
        }),
    )

    return Response.json({ ok: true, cancelledRequests: linkedRequests.filter(req => canCancel(req.status)).length })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/projects/[projectId] DELETE]', err)
    return Response.json({ error: 'Could not delete project.' }, { status: 500 })
  }
}

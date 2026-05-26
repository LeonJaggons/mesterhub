import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { serializeDoc } from '../utils'

const proStatuses = ['pending_verification', 'active', 'suspended', 'rejected'] as const
const requestStatuses = ['pending', 'quoted', 'accepted', 'declined', 'completed', 'cancelled'] as const
const projectStatuses = ['active', 'closed', 'cancelled'] as const
const feedbackStatuses = ['new', 'reviewing', 'planned', 'resolved', 'closed'] as const
const reportStatuses = ['new', 'reviewing', 'action_taken', 'resolved', 'dismissed'] as const

async function countCollection(collection: string): Promise<number> {
  const snap = await adminDb.collection(collection).count().get()
  return snap.data().count
}

async function countByStatus(collection: string, statuses: readonly string[]) {
  const entries = await Promise.all(statuses.map(async status => {
    const snap = await adminDb.collection(collection).where('status', '==', status).count().get()
    return [status, snap.data().count] as const
  }))
  return Object.fromEntries(entries)
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)

    const [
      pros,
      users,
      projects,
      serviceRequests,
      feedback,
      reports,
      conversations,
      mailEvents,
      prosByStatus,
      requestsByStatus,
      projectsByStatus,
      feedbackByStatus,
      reportsByStatus,
      latestReportsSnap,
      latestFeedbackSnap,
      latestRequestsSnap,
      latestProsSnap,
    ] = await Promise.all([
      countCollection('pros'),
      countCollection('users'),
      countCollection('projects'),
      countCollection('serviceRequests'),
      countCollection('feedback'),
      countCollection('reports'),
      countCollection('conversations'),
      countCollection('mailEvents'),
      countByStatus('pros', proStatuses),
      countByStatus('serviceRequests', requestStatuses),
      countByStatus('projects', projectStatuses),
      countByStatus('feedback', feedbackStatuses),
      countByStatus('reports', reportStatuses),
      adminDb.collection('reports').orderBy('createdAt', 'desc').limit(5).get(),
      adminDb.collection('feedback').orderBy('createdAt', 'desc').limit(5).get(),
      adminDb.collection('serviceRequests').orderBy('createdAt', 'desc').limit(5).get(),
      adminDb.collection('pros').orderBy('createdAt', 'desc').limit(5).get(),
    ])

    return Response.json({
      totals: { pros, users, projects, serviceRequests, feedback, reports, conversations, mailEvents },
      prosByStatus,
      requestsByStatus,
      projectsByStatus,
      feedbackByStatus,
      reportsByStatus,
      latest: {
        reports: latestReportsSnap.docs.map(serializeDoc),
        feedback: latestFeedbackSnap.docs.map(serializeDoc),
        serviceRequests: latestRequestsSnap.docs.map(serializeDoc),
        pros: latestProsSnap.docs.map(serializeDoc),
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/overview GET]', err)
    return Response.json({ error: 'Could not load admin overview.' }, { status: 500 })
  }
}

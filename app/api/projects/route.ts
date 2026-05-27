import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { listMarketplaceQuotesForProjects } from '@/lib/marketplaceQuotes'
import { enforceUserRateLimit } from '@/lib/rateLimit'

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, answer]) => [key, cleanString(answer)])
      .filter(([key, answer]) => key && answer),
  )
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => cleanString(item))
    .filter(Boolean)
    .slice(0, 8)
}

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const timestamp = value as { toMillis?: () => number }
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : 0
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const body = await request.json()
    const categoryName = cleanString(body.categoryName)
    const answers = cleanAnswers(body.answers)
    const customerDistrict = cleanString(body.customerDistrict)
    const attachmentUrls = cleanStringArray(body.attachmentUrls)

    if (!categoryName || !answers.project_details || !answers.urgency || !customerDistrict) {
      return Response.json({ error: 'Category, district, urgency, and project details are required.' }, { status: 400 })
    }

    const ref = await adminDb.collection('projects').add({
      customerUid: user.uid,
      customerName: cleanString(body.customerName, user.name ?? ''),
      customerEmail: cleanString(body.customerEmail, user.email ?? ''),
      categoryName,
      answers,
      customerDistrict,
      ...(attachmentUrls.length > 0 ? { attachmentUrls } : {}),
      invitedProUids: [],
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ id: ref.id })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/projects POST]', err)
    return Response.json({ error: 'Could not create project.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authRead', user.uid)
    if (limited) return limited

    const snap = await adminDb
      .collection('projects')
      .where('customerUid', '==', user.uid)
      .get()

    const projects = await Promise.all(
      snap.docs.map(async projectDoc => {
        const requestsSnap = await adminDb
          .collection('serviceRequests')
          .where('projectId', '==', projectDoc.id)
          .where('customerUid', '==', user.uid)
          .get()

        return {
          id: projectDoc.id,
          ...projectDoc.data(),
          hasAppointment: requestsSnap.docs.some(requestDoc => {
            const data = requestDoc.data()
            return Boolean(data.appointmentRequest || data.appointmentChangeRequest)
          }),
        } as Record<string, unknown>
      }),
    )
    const quotesByProject = await listMarketplaceQuotesForProjects(user.uid, projects.map(project => String(project.id)))
    for (const project of projects) {
      project.marketplaceQuotes = quotesByProject.get(String(project.id)) ?? []
    }

    projects.sort((a, b) => {
      const aTime = timestampMillis(a.updatedAt) || timestampMillis(a.createdAt)
      const bTime = timestampMillis(b.updatedAt) || timestampMillis(b.createdAt)
      return bTime - aTime
    })

    return Response.json({ projects })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/projects GET]', err)
    return Response.json({ error: 'Could not load projects.' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { enforceUserRateLimit } from '@/lib/rateLimit'
import { sendAdminNotification } from '@/firebase/adminNotifications'

type TargetRole = 'pro' | 'customer' | 'user'
type ReporterRole = 'pro' | 'customer' | 'user'
type ContextType = 'pro_profile' | 'request' | 'conversation'

type RequestDoc = {
  proUid?: string
  proName?: string
  customerUid?: string
  customerName?: string
  customerEmail?: string
  categoryName?: string
  status?: string
}

const targetRoles = new Set<TargetRole>(['pro', 'customer', 'user'])
const reporterRoles = new Set<ReporterRole>(['pro', 'customer', 'user'])
const contextTypes = new Set<ContextType>(['pro_profile', 'request', 'conversation'])

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanRole<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return allowed.has(value as T) ? value as T : fallback
}

function cleanPath(value: unknown): string {
  const path = cleanString(value, '/')
  return path.startsWith('/') ? path.slice(0, 512) : '/'
}

async function loadRequestContext(requestId: string, reporterUid: string, targetUid: string) {
  if (!requestId) return null
  const snap = await adminDb.collection('serviceRequests').doc(requestId).get()
  if (!snap.exists) throw new Error('REQUEST_NOT_FOUND')

  const data = snap.data() as RequestDoc
  if (data.customerUid !== reporterUid && data.proUid !== reporterUid) throw new Error('FORBIDDEN')
  if (data.customerUid !== targetUid && data.proUid !== targetUid) throw new Error('TARGET_NOT_IN_REQUEST')

  return {
    requestId: snap.id,
    categoryName: data.categoryName ?? '',
    requestStatus: data.status ?? '',
    proUid: data.proUid ?? '',
    proName: data.proName ?? '',
    customerUid: data.customerUid ?? '',
    customerName: data.customerName ?? '',
  }
}

async function assertTargetExists(targetUid: string, targetRole: TargetRole, requestId: string) {
  if (requestId) return
  if (targetRole !== 'pro') {
    throw new Error('REQUEST_REQUIRED')
  }

  const snap = await adminDb.collection('pros').doc(targetUid).get()
  if (!snap.exists) throw new Error('TARGET_NOT_FOUND')
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const body = await request.json()

    const targetUid = cleanString(body.targetUid)
    const targetRole = cleanRole(body.targetRole, targetRoles, 'user')
    const reporterRole = cleanRole(body.reporterRole, reporterRoles, 'user')
    const contextType = cleanRole(body.contextType, contextTypes, 'request')
    const requestId = cleanString(body.requestId)
    const reason = cleanString(body.reason).slice(0, 120)
    const details = cleanString(body.details).slice(0, 2000)
    const targetName = cleanString(body.targetName).slice(0, 160)
    const path = cleanPath(body.path)

    if (!targetUid) {
      return Response.json({ error: 'Report target is required.' }, { status: 400 })
    }
    if (targetUid === user.uid) {
      return Response.json({ error: 'You cannot report yourself.' }, { status: 400 })
    }
    if (!reason) {
      return Response.json({ error: 'Choose a report reason.' }, { status: 400 })
    }
    if (details.length < 10) {
      return Response.json({ error: 'Please include a short description.' }, { status: 400 })
    }

    await assertTargetExists(targetUid, targetRole, requestId)
    const requestContext = await loadRequestContext(requestId, user.uid, targetUid)

    const ref = await adminDb.collection('reports').add({
      status: 'new',
      reason,
      details,
      contextType,
      path,
      requestId: requestContext?.requestId ?? (requestId || null),
      requestContext,
      reporterUid: user.uid,
      reporterEmail: user.email ?? null,
      reporterName: user.name ?? null,
      reporterRole,
      targetUid,
      targetRole,
      targetName,
      userAgent: request.headers.get('user-agent') ?? '',
      referrer: request.headers.get('referer') ?? '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await sendAdminNotification({
      event: 'admin.report.created',
      subject: `New user report: ${reason}`,
      previewText: `${user.email ?? user.uid} reported ${targetName || targetUid}.`,
      text: [
        `A new ${contextType.replaceAll('_', ' ')} report was submitted.`,
        `Reason: ${reason}`,
        `Reporter: ${user.name ?? 'Unknown'} (${user.email ?? user.uid})`,
        `Reported ${targetRole}: ${targetName || targetUid}`,
        requestContext?.categoryName ? `Request: ${requestContext.categoryName} (${requestContext.requestStatus})` : '',
        `Details:\n${details}`,
      ].filter(Boolean).join('\n\n'),
      actionPath: '/admin/reports',
      requestId: requestContext?.requestId ?? (requestId || undefined),
      metadata: {
        reportId: ref.id,
        reporterUid: user.uid,
        targetUid,
        targetRole,
        contextType,
        reason,
      },
    })

    return Response.json({ ok: true, id: ref.id })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in to report a user.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'You can only report users connected to your request.' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'TARGET_NOT_IN_REQUEST') {
      return Response.json({ error: 'Report target is not part of this request.' }, { status: 400 })
    }
    if (err instanceof Error && err.message === 'REQUEST_REQUIRED') {
      return Response.json({ error: 'Customer reports must come from a request or conversation.' }, { status: 400 })
    }
    if (err instanceof Error && (err.message === 'REQUEST_NOT_FOUND' || err.message === 'TARGET_NOT_FOUND')) {
      return Response.json({ error: 'Report target was not found.' }, { status: 404 })
    }
    console.error('[/api/reports POST]', err)
    return Response.json({ error: 'Could not send report.' }, { status: 500 })
  }
}

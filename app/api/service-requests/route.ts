import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { sendLifecycleEmail } from '@/firebase/notifications'
import type { JobLocation, NewServiceRequest } from '@/firebase/serviceRequests'
import { hasPaidProFeatures } from '@/lib/billing'

type ProjectDoc = {
  customerUid: string
  customerName?: string
  customerEmail?: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict?: string
  jobLocation?: JobLocation | null
  attachmentUrls?: string[]
  invitedProUids?: string[]
  status?: 'active' | 'closed' | 'cancelled'
}

async function requireUser(request: NextRequest) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new Error('UNAUTHENTICATED')
  }
  return adminAuth.verifyIdToken(header.slice(7))
}

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

function estimateRequestEmailText(input: {
  customerName: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict: string
  requestUrl: string
}): string {
  const customerName = input.customerName || 'A customer'
  return [
    `${customerName} sent you a request for a ${input.categoryName} estimate on Mestermind.`,
    input.answers.project_details ? `Project details:\n${input.answers.project_details}` : '',
    input.customerDistrict ? `District: ${input.customerDistrict}` : '',
    `Open Mestermind to review the full request and send your estimate: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function answerLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  const value = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : name.slice(0, 2)
  return value.toUpperCase() || 'MM'
}

function estimateRequestEmailHtml(input: {
  customerName: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict: string
  requestUrl: string
}): string {
  const customerName = input.customerName || 'A customer'
  const detailRows = Object.entries(input.answers)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">${escapeEmailHtml(answerLabel(key))}</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;white-space:pre-line;">${escapeEmailHtml(value)}</div>
        </td>
      </tr>
    `)
    .join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fff7ed;border-radius:4px 4px 0 0;border-bottom:1px solid #f1d8c7;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">New estimate request</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">A customer wants pricing from your Mestermind profile</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#2f3033;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(customerName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(customerName)} is looking for ${escapeEmailHtml(input.categoryName)}</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:8px;">
      ${input.customerDistrict ? `
        <tr>
          <td width="26" valign="top" style="padding:0 0 10px;color:#2f3033;font-size:16px;line-height:20px;">&#9679;</td>
          <td valign="top" style="padding:0 0 10px;color:#676d73;font-size:14px;line-height:20px;">Budapest District ${escapeEmailHtml(input.customerDistrict)}</td>
        </tr>
      ` : ''}
      <tr>
        <td width="26" valign="top" style="padding:0 0 10px;color:#2f3033;font-size:16px;line-height:20px;">&#9679;</td>
        <td valign="top" style="padding:0 0 10px;color:#676d73;font-size:14px;line-height:20px;">Reply with an estimate when you are ready</td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:18px 0 24px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">View request details</a>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${detailRows}
    </table>
  `
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const body = (await request.json()) as NewServiceRequest

    if (body.customerUid !== user.uid) {
      return Response.json({ error: 'Cannot create a request for another customer.' }, { status: 403 })
    }

    const requestedProjectId = cleanString(body.projectId)
    const proUid = cleanString(body.proUid)
    let categoryName = cleanString(body.categoryName)
    let answers = cleanAnswers(body.answers)
    let customerDistrict = cleanString(body.customerDistrict)
    let jobLocation: JobLocation | null | undefined = body.jobLocation
    let attachmentUrls = cleanStringArray(body.attachmentUrls)
    const projectRef = requestedProjectId
      ? adminDb.collection('projects').doc(requestedProjectId)
      : adminDb.collection('projects').doc()

    if (!proUid || (!requestedProjectId && (!categoryName || !answers.project_details))) {
      return Response.json({ error: 'Missing required request details.' }, { status: 400 })
    }

    const proSnap = await adminDb.collection('pros').doc(proUid).get()
    if (!proSnap.exists || proSnap.data()?.status !== 'active') {
      return Response.json({ error: 'This pro is not currently available for new requests.' }, { status: 400 })
    }
    const pro = proSnap.data()
    if (!hasPaidProFeatures(pro?.subscriptionStatus, pro?.subscriptionCurrentPeriodEnd)) {
      return Response.json({ error: 'This pro is not accepting direct customer inquiries yet.' }, { status: 400 })
    }

    const proAccountSnap = await adminDb.collection('pros').doc(proUid).collection('private').doc('account').get()
    const proEmail = cleanString(proAccountSnap.data()?.email)

    if (requestedProjectId) {
      const projectSnap = await projectRef.get()
      if (!projectSnap.exists) {
        return Response.json({ error: 'Project not found.' }, { status: 404 })
      }
      const project = projectSnap.data() as ProjectDoc
      if (project.customerUid !== user.uid) {
        return Response.json({ error: 'Cannot reuse another customer project.' }, { status: 403 })
      }
      if (project.status && project.status !== 'active') {
        return Response.json({ error: 'This project is no longer active.' }, { status: 409 })
      }
      if (project.invitedProUids?.includes(proUid)) {
        return Response.json({ error: 'This project was already sent to this pro.' }, { status: 409 })
      }
      categoryName = cleanString(project.categoryName)
      answers = cleanAnswers(project.answers)
      customerDistrict = cleanString(project.customerDistrict)
      jobLocation = project.jobLocation
      attachmentUrls = cleanStringArray(project.attachmentUrls)
    }

    if (!categoryName || !answers.project_details) {
      return Response.json({ error: 'Project is missing required request details.' }, { status: 400 })
    }

    const customerName = cleanString(body.customerName, user.name ?? '')
    const customerDisplayName = customerName || 'A customer'
    const customerEmail = cleanString(body.customerEmail, user.email ?? '')
    const batch = adminDb.batch()
    const requestRef = adminDb.collection('serviceRequests').doc()
    const projectId = projectRef.id
    const projectPayload = {
      customerUid: user.uid,
      customerName,
      customerEmail,
      categoryName,
      answers,
      customerDistrict,
      ...(jobLocation ? { jobLocation } : {}),
      ...(attachmentUrls.length > 0 ? { attachmentUrls } : {}),
      status: 'active',
      invitedProUids: FieldValue.arrayUnion(proUid),
      updatedAt: FieldValue.serverTimestamp(),
      ...(!requestedProjectId ? { createdAt: FieldValue.serverTimestamp() } : {}),
    }
    batch.set(projectRef, projectPayload, { merge: true })
    batch.set(requestRef, {
      projectId,
      proUid,
      proName: cleanString(body.proName),
      categoryName,
      answers,
      customerUid: user.uid,
      customerName,
      customerEmail,
      customerDistrict,
      ...(jobLocation ? { jobLocation } : {}),
      ...(attachmentUrls.length > 0 ? { attachmentUrls } : {}),
      status: 'pending',
      statusHistory: [{
        status: 'pending',
        actorUid: user.uid,
        actorRole: 'customer',
        at: new Date(),
      }],
      createdAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()

    const requestUrl = appUrl(`/pro/jobs/${requestRef.id}`)
    await sendLifecycleEmail({
      to: proEmail,
      event: 'request.created',
      requestId: requestRef.id,
      subject: `${customerDisplayName} requested a ${categoryName} estimate`,
      previewText: `Review the ${categoryName} request and send your estimate on Mestermind.`,
      text: estimateRequestEmailText({ customerName: customerDisplayName, categoryName, answers, customerDistrict, requestUrl }),
      bodyHtml: estimateRequestEmailHtml({ customerName: customerDisplayName, categoryName, answers, customerDistrict, requestUrl }),
      hideSubjectHeading: true,
      metadata: { proUid, customerUid: user.uid, categoryName, projectId, notificationType: 'estimate_request_sent_to_pro' },
    })

    return Response.json({ id: requestRef.id, projectId })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/service-requests]', err)
    return Response.json({ error: 'Could not create request.' }, { status: 500 })
  }
}

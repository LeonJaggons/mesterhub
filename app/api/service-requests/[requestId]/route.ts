import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { createInAppNotification } from '@/firebase/inAppNotifications'
import { sendLifecycleEmail } from '@/firebase/notifications'
import type { AppointmentRequestInput } from '@/firebase/conversations'
import type { QuoteInput } from '@/firebase/serviceRequests'

type RequestDoc = {
  projectId?: string
  proUid: string
  proName: string
  customerUid: string
  customerName: string
  customerEmail?: string
  categoryName: string
  status: 'pending' | 'quoted' | 'accepted' | 'declined' | 'completed' | 'cancelled'
  completion?: { status?: string }
  appointmentRequest?: (AppointmentRequestInput & { status?: 'proposed' | 'confirmed' })
  appointmentChangeRequest?: (AppointmentRequestInput & { status?: 'proposed' | 'confirmed' })
  jobLocation?: unknown
}

type ProjectDoc = {
  customerUid?: string
  status?: 'active' | 'closed' | 'cancelled'
}

type ConversationDoc = {
  proUid: string
  customerUid: string
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

function assertParticipant(req: RequestDoc, uid: string) {
  if (req.customerUid !== uid && req.proUid !== uid) {
    throw new Error('FORBIDDEN')
  }
}

function historyEntry(status: string, actorUid: string, actorRole: 'customer' | 'pro') {
  return {
    status,
    actorUid,
    actorRole,
    at: new Date(),
  }
}

async function proEmail(proUid: string): Promise<string> {
  const snap = await adminDb.collection('pros').doc(proUid).collection('private').doc('account').get()
  const email = snap.data()?.email
  return typeof email === 'string' ? email.trim() : ''
}

function canCancel(status: RequestDoc['status']): boolean {
  return status === 'pending' || status === 'quoted' || status === 'accepted'
}

function hasAppointment(req: RequestDoc): boolean {
  return Boolean(req.appointmentRequest || req.appointmentChangeRequest)
}

function appointmentMessage(input: AppointmentRequestInput): string {
  const title = input.kind === 'quote' ? 'quote visit' : 'service appointment'
  return `Appointment request sent for a ${title}. Please review and confirm it from your request details.`
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
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

function quoteEmailText(input: {
  proName: string
  categoryName: string
  price: string
  timeline: string
  notes: string
  requestUrl: string
}): string {
  return [
    `${input.proName} sent a quote for your ${input.categoryName} request.`,
    `Price: ${input.price}`,
    `Timeline: ${input.timeline}`,
    input.notes ? `Message from ${input.proName}:\n${input.notes}` : '',
    `Open Mestermind to accept, decline, or ask follow-up questions: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function quoteEmailHtml(input: {
  proName: string
  categoryName: string
  price: string
  timeline: string
  notes: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fff7ed;border-radius:4px 4px 0 0;border-bottom:1px solid #f1d8c7;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">New quote received</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">Review the price, timing, and message from your pro</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#2f3033;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.proName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.proName)} sent your ${escapeEmailHtml(input.categoryName)} quote</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px;">
      <tr>
        <td style="padding:16px;background:#fafafa;border:1px solid #e9eced;border-radius:4px;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#676d73;">Quote</div>
          <div style="margin-top:8px;font-size:30px;line-height:36px;font-weight:700;color:#2f3033;">${escapeEmailHtml(input.price)}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Timeline</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;">${escapeEmailHtml(input.timeline)}</div>
        </td>
      </tr>
      ${input.notes ? `
        <tr>
          <td style="padding:16px 0;border-top:1px solid #e9eced;">
            <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Message from ${escapeEmailHtml(input.proName)}</div>
            <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;white-space:pre-line;">${escapeEmailHtml(input.notes)}</div>
          </td>
        </tr>
      ` : ''}
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Review quote</a>
        </td>
      </tr>
    </table>
  `
}

function declinedEmailText(input: {
  proName: string
  categoryName: string
  requestUrl: string
}): string {
  return `${input.proName} cannot take your ${input.categoryName} request. Open Mestermind to review the request and find another pro: ${input.requestUrl}`
}

function declinedEmailHtml(input: {
  proName: string
  categoryName: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fafafa;border-radius:4px 4px 0 0;border-bottom:1px solid #e9eced;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#676d73;">Request update</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">This pro is not available for the job</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#2f3033;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.proName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.proName)} declined your ${escapeEmailHtml(input.categoryName)} request</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">What happens next?</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;">Your request is still saved. You can review the details and invite another pro on Mestermind.</div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">View request</a>
        </td>
      </tr>
    </table>
  `
}

type AcceptanceEmailDetails = {
  message: string
  phone: string
  address: string
  preferredStart: string
  customerEmail: string
}

function acceptedQuoteEmailText(input: {
  customerName: string
  categoryName: string
  details: AcceptanceEmailDetails
  requestUrl: string
}): string {
  return [
    `${input.customerName} accepted your ${input.categoryName} quote.`,
    `Message:\n${input.details.message}`,
    input.details.phone ? `Phone: ${input.details.phone}` : '',
    input.details.customerEmail ? `Email: ${input.details.customerEmail}` : '',
    input.details.address ? `Address: ${input.details.address}` : '',
    input.details.preferredStart ? `Preferred start: ${input.details.preferredStart}` : '',
    `Open Mestermind to coordinate the appointment: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function detailRow(label: string, value: string): string {
  if (!value) return ''
  return `
    <tr>
      <td style="padding:16px 0;border-top:1px solid #e9eced;">
        <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">${escapeEmailHtml(label)}</div>
        <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;white-space:pre-line;">${escapeEmailHtml(value)}</div>
      </td>
    </tr>
  `
}

function acceptedQuoteEmailHtml(input: {
  customerName: string
  categoryName: string
  details: AcceptanceEmailDetails
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#ecfdf5;border-radius:4px 4px 0 0;border-bottom:1px solid #bbf7d0;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#16a34a;">Quote accepted</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">The customer hired you. Use their details to coordinate next steps.</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#16a34a;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.customerName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.customerName)} accepted your ${escapeEmailHtml(input.categoryName)} quote</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${detailRow('Customer message', input.details.message)}
      ${detailRow('Phone', input.details.phone)}
      ${detailRow('Email', input.details.customerEmail)}
      ${detailRow('Address', input.details.address)}
      ${detailRow('Preferred start', input.details.preferredStart)}
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Open job</a>
        </td>
      </tr>
    </table>
  `
}

function declinedQuoteEmailText(input: {
  customerName: string
  categoryName: string
  reason: string
  requestUrl: string
}): string {
  return [
    `${input.customerName} declined your ${input.categoryName} quote.`,
    input.reason ? `Reason:\n${input.reason}` : '',
    `Open Mestermind to review the request: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function declinedQuoteEmailHtml(input: {
  customerName: string
  categoryName: string
  reason: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fafafa;border-radius:4px 4px 0 0;border-bottom:1px solid #e9eced;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#676d73;">Quote declined</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">The customer passed on this quote</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#2f3033;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.customerName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.customerName)} declined your ${escapeEmailHtml(input.categoryName)} quote</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${detailRow('Reason', input.reason || 'No reason was provided.')}
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">What happens next?</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;">This request is now marked declined. You can review it in Mestermind and focus on other open jobs.</div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">View request</a>
        </td>
      </tr>
    </table>
  `
}

function appointmentEmailText(input: {
  proName: string
  categoryName: string
  appointment: AppointmentRequestInput
  requestUrl: string
}): string {
  return [
    `${input.proName} proposed an appointment for your ${input.categoryName} request.`,
    `Date: ${input.appointment.date}`,
    `Time: ${input.appointment.time}`,
    input.appointment.duration ? `Duration: ${input.appointment.duration}` : '',
    input.appointment.location ? `Location: ${input.appointment.location}` : '',
    input.appointment.notes ? `Notes:\n${input.appointment.notes}` : '',
    `Open Mestermind to confirm it: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function appointmentEmailHtml(input: {
  proName: string
  categoryName: string
  appointment: AppointmentRequestInput
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fff7ed;border-radius:4px 4px 0 0;border-bottom:1px solid #f1d8c7;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">Appointment proposed</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">Review the date and time from your pro</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#2f3033;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.proName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.proName)} proposed an appointment</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${detailRow('Service', input.categoryName)}
      ${detailRow('Date', input.appointment.date)}
      ${detailRow('Time', input.appointment.time)}
      ${detailRow('Duration', input.appointment.duration ?? '')}
      ${detailRow('Location', input.appointment.location ?? '')}
      ${detailRow('Notes', input.appointment.notes ?? '')}
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Confirm appointment</a>
        </td>
      </tr>
    </table>
  `
}

function appointmentConfirmedEmailText(input: {
  customerName: string
  categoryName: string
  appointment?: AppointmentRequestInput
  requestUrl: string
}): string {
  return [
    `${input.customerName} confirmed the appointment for ${input.categoryName}.`,
    input.appointment?.date ? `Date: ${input.appointment.date}` : '',
    input.appointment?.time ? `Time: ${input.appointment.time}` : '',
    input.appointment?.duration ? `Duration: ${input.appointment.duration}` : '',
    input.appointment?.location ? `Location: ${input.appointment.location}` : '',
    input.appointment?.notes ? `Notes:\n${input.appointment.notes}` : '',
    `Open Mestermind to view the job: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function appointmentConfirmedEmailHtml(input: {
  customerName: string
  categoryName: string
  appointment?: AppointmentRequestInput
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#ecfdf5;border-radius:4px 4px 0 0;border-bottom:1px solid #bbf7d0;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#16a34a;">Appointment confirmed</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">The customer confirmed your proposed time</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#16a34a;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.customerName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.customerName)} confirmed the appointment</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${detailRow('Service', input.categoryName)}
      ${detailRow('Date', input.appointment?.date ?? '')}
      ${detailRow('Time', input.appointment?.time ?? '')}
      ${detailRow('Duration', input.appointment?.duration ?? '')}
      ${detailRow('Location', input.appointment?.location ?? '')}
      ${detailRow('Notes', input.appointment?.notes ?? '')}
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Open job</a>
        </td>
      </tr>
    </table>
  `
}

function completionRequestedEmailText(input: {
  proName: string
  categoryName: string
  requestUrl: string
}): string {
  return `${input.proName} marked the ${input.categoryName} job complete. Open Mestermind to confirm if the work is finished: ${input.requestUrl}`
}

function completionRequestedEmailHtml(input: {
  proName: string
  categoryName: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#ecfdf5;border-radius:4px 4px 0 0;border-bottom:1px solid #bbf7d0;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#16a34a;">Job marked complete</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">Confirm the work is finished when you are ready</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#16a34a;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.proName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.proName)} marked your ${escapeEmailHtml(input.categoryName)} job complete</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Next step</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;">Review the job and confirm completion if everything is finished.</div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Review job</a>
        </td>
      </tr>
    </table>
  `
}

function jobCompletedEmailText(input: {
  customerName: string
  categoryName: string
  requestUrl: string
}): string {
  return `${input.customerName} confirmed the ${input.categoryName} job is complete. View the completed job on Mestermind: ${input.requestUrl}`
}

function jobCompletedEmailHtml(input: {
  customerName: string
  categoryName: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#ecfdf5;border-radius:4px 4px 0 0;border-bottom:1px solid #bbf7d0;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#16a34a;">Job complete</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">The customer confirmed the work is finished</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#16a34a;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.customerName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.customerName)} confirmed the ${escapeEmailHtml(input.categoryName)} job is complete</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">View completed job</a>
        </td>
      </tr>
    </table>
  `
}

function reviewRequestEmailText(input: {
  proName: string
  categoryName: string
  requestUrl: string
}): string {
  return `${input.categoryName} is complete. Please leave a review for ${input.proName} to help other customers choose with confidence: ${input.requestUrl}`
}

function reviewRequestEmailHtml(input: {
  proName: string
  categoryName: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fff7ed;border-radius:4px 4px 0 0;border-bottom:1px solid #f1d8c7;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">How did it go?</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">Your review helps other customers hire with confidence</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td width="72" valign="middle" style="padding:0 16px 20px 0;">
          <div style="width:72px;height:72px;border-radius:50%;background:#f97316;color:#ffffff;text-align:center;font-size:24px;line-height:72px;font-weight:700;">${escapeEmailHtml(initials(input.proName))}</div>
        </td>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">Review ${escapeEmailHtml(input.proName)}</h1>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Completed job</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;">${escapeEmailHtml(input.categoryName)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Why review?</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;">A short review helps great pros build trust and helps future customers know what to expect.</div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Leave a review</a>
        </td>
      </tr>
    </table>
  `
}

function cancelledEmailText(input: {
  categoryName: string
  actorRole: 'customer' | 'pro'
  reason: string
  requestUrl: string
}): string {
  return [
    `The ${input.categoryName} request was cancelled by the ${input.actorRole}.`,
    input.reason ? `Reason:\n${input.reason}` : '',
    `Open Mestermind to review the request: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function cancelledEmailHtml(input: {
  categoryName: string
  actorRole: 'customer' | 'pro'
  reason: string
  requestUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fafafa;border-radius:4px 4px 0 0;border-bottom:1px solid #e9eced;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#676d73;">Request cancelled</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">This job request is no longer active</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td valign="middle" style="padding:0 0 20px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.categoryName)} request cancelled</h1>
          <p style="margin:8px 0 0;color:#676d73;font-size:15px;line-height:23px;">Cancelled by the ${escapeEmailHtml(input.actorRole)}.</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${detailRow('Reason', input.reason || 'No reason was provided.')}
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.requestUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">View request</a>
        </td>
      </tr>
    </table>
  `
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireUser(request)
    const { requestId } = await params
    const snap = await adminDb.collection('serviceRequests').doc(requestId).get()

    if (!snap.exists) {
      return Response.json({ error: 'Request not found.' }, { status: 404 })
    }

    const requestDoc = snap.data() as RequestDoc
    assertParticipant(requestDoc, user.uid)

    const conversationSnap = await adminDb.collection('conversations').doc(requestId).get()

    return Response.json({
      request: { id: snap.id, ...requestDoc },
      hasConversation: conversationSnap.exists,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }
    console.error('[/api/service-requests/[requestId] GET]', err)
    return Response.json({ error: 'Could not load request.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireUser(request)
    const { requestId } = await params
    const body = await request.json()
    const action = cleanString(body.action)

    const reqRef = adminDb.collection('serviceRequests').doc(requestId)
    const reqSnap = await reqRef.get()
    if (!reqSnap.exists) {
      return Response.json({ error: 'Request not found.' }, { status: 404 })
    }
    const req = reqSnap.data() as RequestDoc

    if (action === 'quote') {
      if (req.proUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'pending') {
        return Response.json({ error: 'Only pending requests can be quoted.' }, { status: 409 })
      }
      const quote = body.quote as QuoteInput | undefined
      const price = cleanString(quote?.price)
      const timeline = cleanString(quote?.timeline)
      const notes = cleanString(quote?.notes)
      if (!price || !timeline) {
        return Response.json({ error: 'Quote price and timeline are required.' }, { status: 400 })
      }
      await reqRef.update({
        status: 'quoted',
        quote: { price, timeline, notes, quotedAt: FieldValue.serverTimestamp() },
        statusHistory: FieldValue.arrayUnion(historyEntry('quoted', user.uid, 'pro')),
      })
      const requestUrl = appUrl(`/requests/${requestId}`)
      await sendLifecycleEmail({
        to: req.customerEmail,
        event: 'quote.sent',
        requestId,
        subject: `${req.proName} sent you a quote`,
        previewText: `Review ${req.proName}'s ${req.categoryName} quote on Mestermind.`,
        text: quoteEmailText({ proName: req.proName, categoryName: req.categoryName, price, timeline, notes, requestUrl }),
        bodyHtml: quoteEmailHtml({ proName: req.proName, categoryName: req.categoryName, price, timeline, notes, requestUrl }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await createInAppNotification({
        recipientUid: req.customerUid,
        recipientRole: 'customer',
        actorUid: user.uid,
        actorRole: 'pro',
        type: 'quote.sent',
        title: 'New quote received',
        body: `${req.proName} sent a quote for your ${req.categoryName} request.`,
        href: `/requests/${requestId}`,
        requestId,
        metadata: { proUid: req.proUid, categoryName: req.categoryName },
      })
      return Response.json({ ok: true })
    }

    if (action === 'decline-pro') {
      if (req.proUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'pending') {
        return Response.json({ error: 'Only pending requests can be declined by a pro.' }, { status: 409 })
      }
      await reqRef.update({
        status: 'declined',
        declinedBy: 'pro',
        declinedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion(historyEntry('declined', user.uid, 'pro')),
      })
      const requestUrl = appUrl(`/requests/${requestId}`)
      await sendLifecycleEmail({
        to: req.customerEmail,
        event: 'request.declined_by_pro',
        requestId,
        subject: `${req.proName} declined your request`,
        previewText: `${req.proName} cannot take this ${req.categoryName} request.`,
        text: declinedEmailText({ proName: req.proName, categoryName: req.categoryName, requestUrl }),
        bodyHtml: declinedEmailHtml({ proName: req.proName, categoryName: req.categoryName, requestUrl }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      return Response.json({ ok: true })
    }

    if (action === 'accept') {
      if (req.customerUid !== user.uid || body.customerUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'quoted') {
        return Response.json({ error: 'This quote can no longer be accepted.' }, { status: 409 })
      }
      const input = body.input ?? {}
      const message = cleanString(input.message)
      if (!message) {
        return Response.json({ error: 'Please include a message for the pro.' }, { status: 400 })
      }
      const acceptanceDetails: AcceptanceEmailDetails = {
        message,
        phone: cleanString(input.phone),
        address: cleanString(input.address),
        preferredStart: cleanString(input.preferredStart),
        customerEmail: cleanString(req.customerEmail),
      }

      const batch = adminDb.batch()
      const convRef = adminDb.collection('conversations').doc(requestId)
      const msgRef = convRef.collection('messages').doc()

      batch.update(reqRef, {
        status: 'accepted',
        acceptance: {
          message,
          phone: cleanString(input.phone),
          address: cleanString(input.address),
          preferredStart: cleanString(input.preferredStart),
          acceptedAt: FieldValue.serverTimestamp(),
        },
        statusHistory: FieldValue.arrayUnion(historyEntry('accepted', user.uid, 'customer')),
      })
      batch.set(convRef, {
        requestId,
        proUid: req.proUid,
        customerUid: req.customerUid,
        proName: req.proName,
        customerName: req.customerName,
        categoryName: req.categoryName,
        lastMessage: message,
        lastMessageAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      })
      batch.set(msgRef, {
        senderUid: user.uid,
        senderRole: 'customer',
        text: message,
        createdAt: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      await sendLifecycleEmail({
        to: await proEmail(req.proUid),
        event: 'quote.accepted',
        requestId,
        subject: `${req.customerName} accepted your quote`,
        previewText: `${req.customerName} accepted your ${req.categoryName} quote.`,
        text: acceptedQuoteEmailText({
          customerName: req.customerName,
          categoryName: req.categoryName,
          details: acceptanceDetails,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        bodyHtml: acceptedQuoteEmailHtml({
          customerName: req.customerName,
          categoryName: req.categoryName,
          details: acceptanceDetails,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await createInAppNotification({
        recipientUid: req.proUid,
        recipientRole: 'pro',
        actorUid: user.uid,
        actorRole: 'customer',
        type: 'quote.accepted',
        title: 'Quote accepted',
        body: `${req.customerName} accepted your ${req.categoryName} quote.`,
        href: `/pro/jobs/${requestId}`,
        requestId,
        metadata: { customerUid: req.customerUid, categoryName: req.categoryName },
      })
      return Response.json({ ok: true })
    }

    if (action === 'decline-customer') {
      if (req.customerUid !== user.uid || body.customerUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'quoted') {
        return Response.json({ error: 'This quote can no longer be declined.' }, { status: 409 })
      }
      const reason = cleanString(body.reason)
      await reqRef.update({
        status: 'declined',
        declinedBy: 'customer',
        declineReason: reason,
        declinedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion(historyEntry('declined', user.uid, 'customer')),
      })
      await sendLifecycleEmail({
        to: await proEmail(req.proUid),
        event: 'quote.declined',
        requestId,
        subject: `${req.customerName} declined your quote`,
        previewText: `${req.customerName} declined your ${req.categoryName} quote.`,
        text: declinedQuoteEmailText({
          customerName: req.customerName,
          categoryName: req.categoryName,
          reason,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        bodyHtml: declinedQuoteEmailHtml({
          customerName: req.customerName,
          categoryName: req.categoryName,
          reason,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await createInAppNotification({
        recipientUid: req.proUid,
        recipientRole: 'pro',
        actorUid: user.uid,
        actorRole: 'customer',
        type: 'quote.declined',
        title: 'Quote declined',
        body: `${req.customerName} declined your ${req.categoryName} quote.`,
        href: `/pro/jobs/${requestId}`,
        requestId,
        metadata: { customerUid: req.customerUid, categoryName: req.categoryName, reason },
      })
      return Response.json({ ok: true })
    }

    if (action === 'request-appointment') {
      if (req.proUid !== user.uid || body.proUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'accepted') {
        return Response.json({ error: 'Appointments can only be proposed after quote acceptance.' }, { status: 409 })
      }
      const input = body.input as AppointmentRequestInput | undefined
      if (!input?.date || !input.time) {
        return Response.json({ error: 'Please choose a date and time.' }, { status: 400 })
      }
      const message = cleanString(body.message, appointmentMessage(input))
      const batch = adminDb.batch()
      const convRef = adminDb.collection('conversations').doc(requestId)
      const msgRef = convRef.collection('messages').doc()
      const appointmentKind: AppointmentRequestInput['kind'] = input.kind === 'quote' ? 'quote' : 'service'
      const appointmentForEmail: AppointmentRequestInput = {
        kind: appointmentKind,
        date: cleanString(input.date),
        time: cleanString(input.time),
        duration: cleanString(input.duration),
        location: cleanString(input.location),
        notes: cleanString(input.notes),
      }
      const proposedAppointment = {
        ...appointmentForEmail,
        jobLocation: req.jobLocation ?? null,
        status: 'proposed',
        requestedAt: FieldValue.serverTimestamp(),
        confirmedAt: null,
      }
      const isChangeRequest = req.appointmentRequest?.status === 'confirmed'

      batch.update(reqRef, {
        [isChangeRequest ? 'appointmentChangeRequest' : 'appointmentRequest']: proposedAppointment,
        statusHistory: FieldValue.arrayUnion(historyEntry(isChangeRequest ? 'appointment_change_proposed' : 'appointment_proposed', user.uid, 'pro')),
      })
      batch.set(convRef, {
        requestId,
        proUid: req.proUid,
        customerUid: req.customerUid,
        proName: req.proName,
        customerName: req.customerName,
        categoryName: req.categoryName,
        lastMessage: message,
        lastMessageAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      batch.set(msgRef, {
        senderUid: user.uid,
        senderRole: 'pro',
        text: message,
        createdAt: FieldValue.serverTimestamp(),
      })
      await batch.commit()
      await sendLifecycleEmail({
        to: req.customerEmail,
        event: 'appointment.proposed',
        requestId,
        subject: `${req.proName} proposed an appointment`,
        previewText: `${req.proName} proposed an appointment for your ${req.categoryName} request.`,
        text: appointmentEmailText({
          proName: req.proName,
          categoryName: req.categoryName,
          appointment: appointmentForEmail,
          requestUrl: appUrl(`/requests/${requestId}`),
        }),
        bodyHtml: appointmentEmailHtml({
          proName: req.proName,
          categoryName: req.categoryName,
          appointment: appointmentForEmail,
          requestUrl: appUrl(`/requests/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await createInAppNotification({
        recipientUid: req.customerUid,
        recipientRole: 'customer',
        actorUid: user.uid,
        actorRole: 'pro',
        type: 'appointment.proposed',
        title: isChangeRequest ? 'Appointment change proposed' : 'Appointment proposed',
        body: `${req.proName} proposed an appointment for your ${req.categoryName} request.`,
        href: `/requests/${requestId}`,
        requestId,
        metadata: { proUid: req.proUid, categoryName: req.categoryName, appointmentKind },
      })
      return Response.json({ ok: true })
    }

    if (action === 'confirm-appointment') {
      if (req.customerUid !== user.uid || body.customerUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'accepted') {
        return Response.json({ error: 'Only accepted requests can confirm appointments.' }, { status: 409 })
      }
      const appointmentChange = req.appointmentChangeRequest
      const confirmedAppointment = appointmentChange?.status === 'proposed'
        ? appointmentChange
        : req.appointmentRequest
      if (appointmentChange?.status === 'proposed') {
        await reqRef.update({
          appointmentRequest: {
            ...appointmentChange,
            status: 'confirmed',
            confirmedAt: FieldValue.serverTimestamp(),
          },
          appointmentChangeRequest: FieldValue.delete(),
          statusHistory: FieldValue.arrayUnion(historyEntry('appointment_change_confirmed', user.uid, 'customer')),
        })
      } else {
        await reqRef.update({
          'appointmentRequest.status': 'confirmed',
          'appointmentRequest.confirmedAt': FieldValue.serverTimestamp(),
          statusHistory: FieldValue.arrayUnion(historyEntry('appointment_confirmed', user.uid, 'customer')),
        })
      }
      await sendLifecycleEmail({
        to: await proEmail(req.proUid),
        event: 'appointment.confirmed',
        requestId,
        subject: `${req.customerName} confirmed the appointment`,
        previewText: `${req.customerName} confirmed the appointment for ${req.categoryName}.`,
        text: appointmentConfirmedEmailText({
          customerName: req.customerName,
          categoryName: req.categoryName,
          appointment: confirmedAppointment,
          requestUrl: appUrl(`/pro/appointments/${requestId}`),
        }),
        bodyHtml: appointmentConfirmedEmailHtml({
          customerName: req.customerName,
          categoryName: req.categoryName,
          appointment: confirmedAppointment,
          requestUrl: appUrl(`/pro/appointments/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await createInAppNotification({
        recipientUid: req.proUid,
        recipientRole: 'pro',
        actorUid: user.uid,
        actorRole: 'customer',
        type: 'appointment.confirmed',
        title: 'Appointment confirmed',
        body: `${req.customerName} confirmed the appointment for ${req.categoryName}.`,
        href: `/pro/jobs/${requestId}`,
        requestId,
        metadata: { customerUid: req.customerUid, categoryName: req.categoryName },
      })
      return Response.json({ ok: true })
    }

    if (action === 'send-message') {
      assertParticipant(req, user.uid)
      if (body.senderUid !== user.uid) throw new Error('FORBIDDEN')
      const text = cleanString(body.text)
      const senderRole = body.senderRole === 'pro' ? 'pro' : 'customer'
      if (!text) return Response.json({ error: 'Message cannot be empty.' }, { status: 400 })
      if ((senderRole === 'pro' && req.proUid !== user.uid) || (senderRole === 'customer' && req.customerUid !== user.uid)) {
        throw new Error('FORBIDDEN')
      }

      const convRef = adminDb.collection('conversations').doc(requestId)
      const convSnap = await convRef.get()
      if (!convSnap.exists) {
        return Response.json({ error: 'Conversation not found.' }, { status: 404 })
      }
      const conv = convSnap.data() as ConversationDoc
      if (conv.customerUid !== user.uid && conv.proUid !== user.uid) throw new Error('FORBIDDEN')

      const recipientRole = senderRole === 'pro' ? 'customer' : 'pro'
      const recipientUid = recipientRole === 'pro' ? req.proUid : req.customerUid
      const recipientEmail = recipientRole === 'pro' ? await proEmail(req.proUid) : cleanString(req.customerEmail)
      const senderName = senderRole === 'pro'
        ? cleanString(req.proName, 'Your pro')
        : cleanString(req.customerName, 'The customer')
      const batch = adminDb.batch()
      batch.set(convRef.collection('messages').doc(), {
        senderUid: user.uid,
        senderRole,
        text,
        createdAt: FieldValue.serverTimestamp(),
      })
      batch.update(convRef, {
        lastMessage: text,
        lastMessageAt: FieldValue.serverTimestamp(),
      })
      batch.set(adminDb.collection('messageDigests').doc(`${requestId}_${recipientUid}`), {
        requestId,
        recipientUid,
        recipientRole,
        recipientEmail,
        senderName,
        lastSenderUid: user.uid,
        lastSenderRole: senderRole,
        lastMessage: text,
        lastMessageAt: FieldValue.serverTimestamp(),
        pendingCount: FieldValue.increment(1),
        status: 'pending',
        categoryName: req.categoryName,
        proUid: req.proUid,
        customerUid: req.customerUid,
        proName: req.proName,
        customerName: req.customerName,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      await batch.commit()
      await createInAppNotification({
        recipientUid,
        recipientRole,
        actorUid: user.uid,
        actorRole: senderRole,
        type: 'message.received',
        title: `New message from ${senderName}`,
        body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
        href: recipientRole === 'pro' ? `/pro/messages/${requestId}` : `/messages/${requestId}`,
        requestId,
        metadata: { proUid: req.proUid, customerUid: req.customerUid, categoryName: req.categoryName },
      })
      return Response.json({ ok: true })
    }

    if (action === 'mark-complete') {
      if (req.proUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'accepted') {
        return Response.json({ error: 'Only accepted requests can be marked complete.' }, { status: 409 })
      }
      await reqRef.update({
        completion: {
          status: 'pro_marked_complete',
          proMarkedAt: FieldValue.serverTimestamp(),
          confirmedAt: null,
        },
        statusHistory: FieldValue.arrayUnion(historyEntry('completion_requested', user.uid, 'pro')),
      })
      await sendLifecycleEmail({
        to: req.customerEmail,
        event: 'completion.requested',
        requestId,
        subject: `${req.proName} marked your job complete`,
        previewText: `${req.proName} marked the ${req.categoryName} job complete.`,
        text: completionRequestedEmailText({
          proName: req.proName,
          categoryName: req.categoryName,
          requestUrl: appUrl(`/requests/${requestId}`),
        }),
        bodyHtml: completionRequestedEmailHtml({
          proName: req.proName,
          categoryName: req.categoryName,
          requestUrl: appUrl(`/requests/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await createInAppNotification({
        recipientUid: req.customerUid,
        recipientRole: 'customer',
        actorUid: user.uid,
        actorRole: 'pro',
        type: 'completion.requested',
        title: 'Confirm job completion',
        body: `${req.proName} marked your ${req.categoryName} job complete.`,
        href: `/requests/${requestId}`,
        requestId,
        metadata: { proUid: req.proUid, categoryName: req.categoryName },
      })
      return Response.json({ ok: true })
    }

    if (action === 'confirm-complete') {
      if (req.customerUid !== user.uid) throw new Error('FORBIDDEN')
      if (req.status !== 'accepted' || req.completion?.status !== 'pro_marked_complete') {
        return Response.json({ error: 'This request is not ready to complete.' }, { status: 409 })
      }
      const batch = adminDb.batch()
      batch.update(reqRef, {
        status: 'completed',
        'completion.status': 'confirmed_complete',
        'completion.confirmedAt': FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion(historyEntry('completed', user.uid, 'customer')),
      })

      if (req.projectId) {
        const projectRef = adminDb.collection('projects').doc(req.projectId)
        const projectSnap = await projectRef.get()
        const project = projectSnap.exists ? projectSnap.data() as ProjectDoc : null
        if (project?.customerUid === req.customerUid && project.status !== 'cancelled') {
          batch.update(projectRef, {
            status: 'closed',
            completedRequestId: requestId,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
        }
      }

      await batch.commit()
      await sendLifecycleEmail({
        to: await proEmail(req.proUid),
        event: 'request.completed',
        requestId,
        subject: `${req.customerName} confirmed the job is complete`,
        previewText: `${req.customerName} confirmed the ${req.categoryName} job is complete.`,
        text: jobCompletedEmailText({
          customerName: req.customerName,
          categoryName: req.categoryName,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        bodyHtml: jobCompletedEmailHtml({
          customerName: req.customerName,
          categoryName: req.categoryName,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid },
      })
      await sendLifecycleEmail({
        to: req.customerEmail,
        event: 'review.requested',
        requestId,
        subject: `Review ${req.proName} on Mestermind`,
        previewText: `Tell other customers how your ${req.categoryName} job went.`,
        text: reviewRequestEmailText({
          proName: req.proName,
          categoryName: req.categoryName,
          requestUrl: appUrl(`/requests/${requestId}#review`),
        }),
        bodyHtml: reviewRequestEmailHtml({
          proName: req.proName,
          categoryName: req.categoryName,
          requestUrl: appUrl(`/requests/${requestId}#review`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid, categoryName: req.categoryName },
      })
      await createInAppNotification({
        recipientUid: req.proUid,
        recipientRole: 'pro',
        actorUid: user.uid,
        actorRole: 'customer',
        type: 'request.completed',
        title: 'Job completed',
        body: `${req.customerName} confirmed the ${req.categoryName} job is complete.`,
        href: `/pro/jobs/${requestId}`,
        requestId,
        metadata: { customerUid: req.customerUid, categoryName: req.categoryName },
      })
      return Response.json({ ok: true })
    }

    if (action === 'cancel') {
      assertParticipant(req, user.uid)
      if (!canCancel(req.status)) {
        return Response.json({ error: 'This request can no longer be cancelled.' }, { status: 409 })
      }
      const actorRole = req.proUid === user.uid ? 'pro' : 'customer'
      const reason = cleanString(body.reason)
      await reqRef.update({
        status: 'cancelled',
        cancelledBy: actorRole,
        cancelReason: reason,
        cancelledAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion(historyEntry('cancelled', user.uid, actorRole)),
      })
      await sendLifecycleEmail({
        to: actorRole === 'pro' ? req.customerEmail : await proEmail(req.proUid),
        event: 'request.cancelled',
        requestId,
        subject: `${req.categoryName} request cancelled`,
        previewText: `The ${req.categoryName} request was cancelled by the ${actorRole}.`,
        text: cancelledEmailText({
          categoryName: req.categoryName,
          actorRole,
          reason,
          requestUrl: appUrl(actorRole === 'pro' ? `/requests/${requestId}` : `/pro/jobs/${requestId}`),
        }),
        bodyHtml: cancelledEmailHtml({
          categoryName: req.categoryName,
          actorRole,
          reason,
          requestUrl: appUrl(actorRole === 'pro' ? `/requests/${requestId}` : `/pro/jobs/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid, cancelledBy: actorRole },
      })
      await createInAppNotification({
        recipientUid: actorRole === 'pro' ? req.customerUid : req.proUid,
        recipientRole: actorRole === 'pro' ? 'customer' : 'pro',
        actorUid: user.uid,
        actorRole,
        type: 'request.cancelled',
        title: 'Request cancelled',
        body: `The ${req.categoryName} request was cancelled by the ${actorRole}.`,
        href: actorRole === 'pro' ? `/requests/${requestId}` : `/pro/jobs/${requestId}`,
        requestId,
        metadata: { proUid: req.proUid, customerUid: req.customerUid, cancelledBy: actorRole, reason },
      })
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }
    console.error('[/api/service-requests/[requestId]]', err)
    return Response.json({ error: 'Could not update request.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  try {
    const user = await requireUser(request)
    const { requestId } = await params
    const reqRef = adminDb.collection('serviceRequests').doc(requestId)
    const reqSnap = await reqRef.get()
    if (!reqSnap.exists) {
      return Response.json({ error: 'Request not found.' }, { status: 404 })
    }

    const req = reqSnap.data() as RequestDoc
    if (req.customerUid !== user.uid) throw new Error('FORBIDDEN')
    if (req.status === 'completed') {
      return Response.json({ error: 'Completed jobs cannot be deleted.' }, { status: 409 })
    }
    if (hasAppointment(req)) {
      return Response.json({ error: 'Requests with appointments cannot be deleted.' }, { status: 409 })
    }

    const batch = adminDb.batch()
    const update: Record<string, unknown> = {
      customerDeletedAt: FieldValue.serverTimestamp(),
      customerDeletedBy: user.uid,
    }
    const shouldCancel = canCancel(req.status)
    const reason = 'Deleted by customer.'

    if (shouldCancel) {
      update.status = 'cancelled'
      update.cancelledBy = 'customer'
      update.cancelReason = reason
      update.cancelledAt = FieldValue.serverTimestamp()
      update.statusHistory = FieldValue.arrayUnion(historyEntry('cancelled', user.uid, 'customer'))
    }

    batch.update(reqRef, update)

    if (req.projectId) {
      const projectRef = adminDb.collection('projects').doc(req.projectId)
      const projectSnap = await projectRef.get()
      if (projectSnap.exists) {
        batch.update(projectRef, {
          invitedProUids: FieldValue.arrayRemove(req.proUid),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
    }

    const convRef = adminDb.collection('conversations').doc(requestId)
    const convSnap = await convRef.get()
    if (convSnap.exists) {
      batch.update(convRef, {
        customerDeletedAt: FieldValue.serverTimestamp(),
        customerDeletedBy: user.uid,
      })
    }

    batch.delete(adminDb.collection('messageDigests').doc(`${requestId}_${user.uid}`))
    await batch.commit()

    if (shouldCancel) {
      await sendLifecycleEmail({
        to: await proEmail(req.proUid),
        event: 'request.cancelled',
        requestId,
        subject: `${req.categoryName} request cancelled`,
        previewText: `The ${req.categoryName} request was cancelled by the customer.`,
        text: cancelledEmailText({
          categoryName: req.categoryName,
          actorRole: 'customer',
          reason,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        bodyHtml: cancelledEmailHtml({
          categoryName: req.categoryName,
          actorRole: 'customer',
          reason,
          requestUrl: appUrl(`/pro/jobs/${requestId}`),
        }),
        hideSubjectHeading: true,
        metadata: { proUid: req.proUid, customerUid: req.customerUid, cancelledBy: 'customer', deletedByCustomer: true },
      })
    }

    return Response.json({ ok: true, cancelled: shouldCancel })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }
    console.error('[/api/service-requests/[requestId] DELETE]', err)
    return Response.json({ error: 'Could not delete request.' }, { status: 500 })
  }
}

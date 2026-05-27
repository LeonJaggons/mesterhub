import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { sendLifecycleEmail } from '@/firebase/notifications'
import {
  appUrl,
  cleanString,
  CRON_BATCH_LIMIT,
  emailCardHtml,
  proEmail,
  requireCron,
} from '../utils'
import { huCategory } from '@/lib/i18n/email'

type Appointment = {
  date?: string
  time?: string
  duration?: string
  location?: string
  notes?: string
  status?: string
}

type ServiceRequest = {
  proUid?: string
  proName?: string
  customerUid?: string
  customerName?: string
  customerEmail?: string
  categoryName?: string
  appointmentRequest?: Appointment
  reminders?: {
    appointment24h?: {
      key?: string
      customerSentAt?: unknown
      proSentAt?: unknown
    }
  }
}

function appointmentStart(appointment?: Appointment): Date | null {
  if (!appointment?.date || !appointment.time) return null
  const parsed = new Date(`${appointment.date}T${appointment.time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function appointmentKey(appointment: Appointment): string {
  return `${appointment.date ?? ''} ${appointment.time ?? ''}`.trim()
}

function reminderText(input: {
  recipientRole: 'customer' | 'pro'
  otherParty: string
  categoryName: string
  appointment: Appointment
  requestUrl: string
}): string {
  return [
    `Reminder: your ${input.categoryName} appointment with ${input.otherParty} is tomorrow.`,
    `Date: ${input.appointment.date}`,
    `Time: ${input.appointment.time}`,
    input.appointment.duration ? `Duration: ${input.appointment.duration}` : '',
    input.appointment.location ? `Meeting note: ${input.appointment.location}` : '',
    `Open Mestermind to review the appointment: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

function reminderTextHu(input: {
  recipientRole: 'customer' | 'pro'
  otherParty: string
  categoryName: string
  appointment: Appointment
  requestUrl: string
}): string {
  return [
    `Emlékeztető: a(z) ${input.categoryName} időpontod ${input.otherParty} partnerrel holnap lesz.`,
    `Dátum: ${input.appointment.date}`,
    `Idő: ${input.appointment.time}`,
    input.appointment.duration ? `Időtartam: ${input.appointment.duration}` : '',
    input.appointment.location ? `Találkozási megjegyzés: ${input.appointment.location}` : '',
    `Nyisd meg a Mestermindet az időpont áttekintéséhez: ${input.requestUrl}`,
  ].filter(Boolean).join('\n\n')
}

async function sendReminder(input: {
  to: string
  recipientRole: 'customer' | 'pro'
  otherParty: string
  categoryName: string
  appointment: Appointment
  requestId: string
  proUid?: string
  customerUid?: string
}) {
  const requestUrl = appUrl(input.recipientRole === 'pro'
    ? `/pro/appointments/${input.requestId}`
    : `/requests/${input.requestId}`)
  const categoryNameHu = huCategory(input.categoryName)
  await sendLifecycleEmail({
    to: input.to,
    event: 'appointment.reminder_24h',
    requestId: input.requestId,
    subject: `Reminder: ${input.categoryName} appointment tomorrow`,
    previewText: `Your appointment with ${input.otherParty} is tomorrow.`,
    text: reminderText({ ...input, requestUrl }),
    bodyHtml: emailCardHtml({
      eyebrow: 'Appointment reminder',
      title: `${input.categoryName} appointment tomorrow`,
      intro: `Your appointment with ${input.otherParty} is coming up.`,
      rows: [
        ['Date', input.appointment.date],
        ['Time', input.appointment.time],
        ['Duration', input.appointment.duration],
        ['Meeting note', input.appointment.location],
        ['Notes', input.appointment.notes],
      ],
      ctaLabel: 'View appointment',
      ctaUrl: requestUrl,
      tone: 'orange',
    }),
    localized: {
      hu: {
        subject: `Emlékeztető: ${categoryNameHu} időpont holnap`,
        previewText: `Az időpontod ${input.otherParty} partnerrel holnap lesz.`,
        text: reminderTextHu({ ...input, categoryName: categoryNameHu, requestUrl }),
        bodyHtml: emailCardHtml({
          eyebrow: 'Időpont emlékeztető',
          title: `${categoryNameHu} időpont holnap`,
          intro: `Közeledik az időpontod ${input.otherParty} partnerrel.`,
          rows: [
            ['Dátum', input.appointment.date],
            ['Idő', input.appointment.time],
            ['Időtartam', input.appointment.duration],
            ['Találkozási megjegyzés', input.appointment.location],
            ['Megjegyzések', input.appointment.notes],
          ],
          ctaLabel: 'Időpont megtekintése',
          ctaUrl: requestUrl,
          tone: 'orange',
        }),
      },
    },
    hideSubjectHeading: true,
    metadata: {
      recipientUid: input.recipientRole === 'pro' ? input.proUid : input.customerUid,
      recipientRole: input.recipientRole,
      proUid: input.proUid,
      customerUid: input.customerUid,
      categoryName: input.categoryName,
    },
  })
}

export async function GET(request: Request) {
  const unauthorized = requireCron(request)
  if (unauthorized) return unauthorized

  const now = Date.now()
  const windowStart = now + 23.5 * 60 * 60 * 1000
  const windowEnd = now + 24.5 * 60 * 60 * 1000
  let scanned = 0
  let sent = 0

  const snap = await adminDb
    .collection('serviceRequests')
    .where('status', '==', 'accepted')
    .limit(CRON_BATCH_LIMIT)
    .get()

  for (const doc of snap.docs) {
    scanned += 1
    const data = doc.data() as ServiceRequest
    const appointment = data.appointmentRequest
    if (appointment?.status !== 'confirmed') continue

    const startsAt = appointmentStart(appointment)
    if (!startsAt) continue

    const startsAtMs = startsAt.getTime()
    if (startsAtMs < windowStart || startsAtMs > windowEnd) continue

    const key = appointmentKey(appointment)
    const reminder = data.reminders?.appointment24h
    const updates: Record<string, unknown> = {}

    if (reminder?.key !== key || !reminder.customerSentAt) {
      await sendReminder({
        to: cleanString(data.customerEmail),
        recipientRole: 'customer',
        otherParty: cleanString(data.proName, 'your pro'),
        categoryName: cleanString(data.categoryName, 'Service'),
        appointment,
        requestId: doc.id,
        proUid: data.proUid,
        customerUid: data.customerUid,
      })
      updates['reminders.appointment24h.customerSentAt'] = FieldValue.serverTimestamp()
      sent += 1
    }

    if (reminder?.key !== key || !reminder.proSentAt) {
      await sendReminder({
        to: await proEmail(data.proUid),
        recipientRole: 'pro',
        otherParty: cleanString(data.customerName, 'the customer'),
        categoryName: cleanString(data.categoryName, 'Service'),
        appointment,
        requestId: doc.id,
        proUid: data.proUid,
        customerUid: data.customerUid,
      })
      updates['reminders.appointment24h.proSentAt'] = FieldValue.serverTimestamp()
      sent += 1
    }

    if (Object.keys(updates).length > 0) {
      updates['reminders.appointment24h.key'] = key
      updates['reminders.appointment24h.updatedAt'] = FieldValue.serverTimestamp()
      await doc.ref.update(updates)
    }
  }

  return Response.json({ ok: true, scanned, sent })
}

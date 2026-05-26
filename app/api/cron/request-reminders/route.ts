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
  toDate,
} from '../utils'

type ServiceRequest = {
  proUid?: string
  customerUid?: string
  customerName?: string
  categoryName?: string
  customerDistrict?: string
  createdAt?: unknown
  reminders?: {
    request12h?: {
      sentAt?: unknown
    }
  }
}

export async function GET(request: Request) {
  const unauthorized = requireCron(request)
  if (unauthorized) return unauthorized

  const cutoff = Date.now() - 12 * 60 * 60 * 1000
  let scanned = 0
  let sent = 0

  const snap = await adminDb
    .collection('serviceRequests')
    .where('status', '==', 'pending')
    .limit(CRON_BATCH_LIMIT)
    .get()

  for (const doc of snap.docs) {
    scanned += 1
    const data = doc.data() as ServiceRequest
    if (data.reminders?.request12h?.sentAt) continue

    const createdAt = toDate(data.createdAt)
    if (createdAt && createdAt.getTime() > cutoff) continue

    const requestUrl = appUrl(`/pro/jobs/${doc.id}`)
    const customerName = cleanString(data.customerName, 'A customer')
    const categoryName = cleanString(data.categoryName, 'service')

    await sendLifecycleEmail({
      to: await proEmail(data.proUid),
      event: 'request.reminder_12h',
      requestId: doc.id,
      subject: `Reminder: ${customerName} is waiting for your estimate`,
      previewText: `Review the ${categoryName} request and respond on Mestermind.`,
      text: [
        `${customerName} is still waiting for your ${categoryName} estimate.`,
        data.customerDistrict ? `District: ${data.customerDistrict}` : '',
        `Open Mestermind to send a quote or decline the request: ${requestUrl}`,
      ].filter(Boolean).join('\n\n'),
      bodyHtml: emailCardHtml({
        eyebrow: 'Estimate reminder',
        title: `${customerName} is waiting for your estimate`,
        intro: 'Responding quickly helps customers move forward.',
        rows: [
          ['Service', categoryName],
          ['District', data.customerDistrict],
        ],
        ctaLabel: 'View request',
        ctaUrl: requestUrl,
        tone: 'orange',
      }),
      localized: {
        hu: {
          subject: `Emlékeztető: ${customerName} várja az ajánlatod`,
          previewText: `Nézd át a(z) ${categoryName} kérést, és válaszolj a Mestermindben.`,
          text: [
            `${customerName} továbbra is várja a(z) ${categoryName} ajánlatod.`,
            data.customerDistrict ? `Kerület: ${data.customerDistrict}` : '',
            `Nyisd meg a Mestermindet az ajánlat elküldéséhez vagy a kérés elutasításához: ${requestUrl}`,
          ].filter(Boolean).join('\n\n'),
          bodyHtml: emailCardHtml({
            eyebrow: 'Árajánlat emlékeztető',
            title: `${customerName} várja az ajánlatod`,
            intro: 'A gyors válasz segít az ügyfeleknek továbblépni.',
            rows: [
              ['Szolgáltatás', categoryName],
              ['Kerület', data.customerDistrict],
            ],
            ctaLabel: 'Kérés megtekintése',
            ctaUrl: requestUrl,
            tone: 'orange',
          }),
        },
      },
      hideSubjectHeading: true,
      metadata: { recipientUid: data.proUid, proUid: data.proUid, customerUid: data.customerUid, categoryName },
    })

    await doc.ref.update({
      'reminders.request12h.sentAt': FieldValue.serverTimestamp(),
    })
    sent += 1
  }

  return Response.json({ ok: true, scanned, sent })
}

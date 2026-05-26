import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { sendLifecycleEmail } from '@/firebase/notifications'
import {
  appUrl,
  cleanString,
  CRON_BATCH_LIMIT,
  emailCardHtml,
  requireCron,
  toDate,
} from '../utils'

type Quote = {
  price?: string
  timeline?: string
  notes?: string
  quotedAt?: unknown
}

type ServiceRequest = {
  proUid?: string
  proName?: string
  customerUid?: string
  customerEmail?: string
  categoryName?: string
  quote?: Quote
  reminders?: {
    quote12h?: {
      key?: string
      sentAt?: unknown
    }
  }
}

function quoteKey(quote?: Quote): string {
  const quotedAt = toDate(quote?.quotedAt)?.toISOString() ?? 'unknown'
  return `${quotedAt}:${cleanString(quote?.price)}:${cleanString(quote?.timeline)}`
}

export async function GET(request: Request) {
  const unauthorized = requireCron(request)
  if (unauthorized) return unauthorized

  const cutoff = Date.now() - 12 * 60 * 60 * 1000
  let scanned = 0
  let sent = 0

  const snap = await adminDb
    .collection('serviceRequests')
    .where('status', '==', 'quoted')
    .limit(CRON_BATCH_LIMIT)
    .get()

  for (const doc of snap.docs) {
    scanned += 1
    const data = doc.data() as ServiceRequest
    const quote = data.quote
    const quotedAt = toDate(quote?.quotedAt)
    if (quotedAt && quotedAt.getTime() > cutoff) continue

    const key = quoteKey(quote)
    if (data.reminders?.quote12h?.key === key && data.reminders.quote12h.sentAt) continue

    const requestUrl = appUrl(`/requests/${doc.id}`)
    const proName = cleanString(data.proName, 'Your pro')
    const categoryName = cleanString(data.categoryName, 'service')
    const price = cleanString(quote?.price, 'Quote sent')
    const timeline = cleanString(quote?.timeline)

    await sendLifecycleEmail({
      to: cleanString(data.customerEmail),
      event: 'quote.reminder_12h',
      requestId: doc.id,
      subject: `Reminder: ${proName} sent you a quote`,
      previewText: `Review your ${categoryName} quote on Mestermind.`,
      text: [
        `${proName} sent a quote for your ${categoryName} request.`,
        `Price: ${price}`,
        timeline ? `Timeline: ${timeline}` : '',
        `Open Mestermind to accept, decline, or ask follow-up questions: ${requestUrl}`,
      ].filter(Boolean).join('\n\n'),
      bodyHtml: emailCardHtml({
        eyebrow: 'Quote reminder',
        title: `${proName} sent you a quote`,
        intro: 'Review it when you are ready.',
        rows: [
          ['Service', categoryName],
          ['Price', price],
          ['Timeline', timeline],
          ['Message', quote?.notes],
        ],
        ctaLabel: 'Review quote',
        ctaUrl: requestUrl,
        tone: 'orange',
      }),
      localized: {
        hu: {
          subject: `Emlékeztető: ${proName} ajánlatot küldött`,
          previewText: `Nézd át a(z) ${categoryName} ajánlatod a Mestermindben.`,
          text: [
            `${proName} ajánlatot küldött a(z) ${categoryName} kérésedre.`,
            `Ár: ${price}`,
            timeline ? `Időzítés: ${timeline}` : '',
            `Nyisd meg a Mestermindet az ajánlat elfogadásához, elutasításához vagy további kérdésekhez: ${requestUrl}`,
          ].filter(Boolean).join('\n\n'),
          bodyHtml: emailCardHtml({
            eyebrow: 'Ajánlat emlékeztető',
            title: `${proName} ajánlatot küldött`,
            intro: 'Nézd át, amikor készen állsz.',
            rows: [
              ['Szolgáltatás', categoryName],
              ['Ár', price],
              ['Időzítés', timeline],
              ['Üzenet', quote?.notes],
            ],
            ctaLabel: 'Ajánlat áttekintése',
            ctaUrl: requestUrl,
            tone: 'orange',
          }),
        },
      },
      hideSubjectHeading: true,
      metadata: { recipientUid: data.customerUid, proUid: data.proUid, customerUid: data.customerUid, categoryName, reminderKey: key },
    })

    await doc.ref.update({
      'reminders.quote12h.key': key,
      'reminders.quote12h.sentAt': FieldValue.serverTimestamp(),
    })
    sent += 1
  }

  return Response.json({ ok: true, scanned, sent })
}

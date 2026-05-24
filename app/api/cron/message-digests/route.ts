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

const MESSAGE_DIGEST_COOLDOWN_MS = 30 * 60 * 1000

type MessageDigest = {
  requestId?: string
  recipientUid?: string
  recipientRole?: 'customer' | 'pro'
  recipientEmail?: string
  senderName?: string
  lastSenderUid?: string
  lastSenderRole?: 'customer' | 'pro'
  lastMessage?: string
  pendingCount?: number
  categoryName?: string
  proUid?: string
  customerUid?: string
  lastSentAt?: unknown
}

function digestSubject(input: { count: number; categoryName: string }): string {
  return input.count > 1
    ? `${input.count} new messages about ${input.categoryName}`
    : `New message about ${input.categoryName}`
}

export async function GET(request: Request) {
  const unauthorized = requireCron(request)
  if (unauthorized) return unauthorized

  let scanned = 0
  let sent = 0

  const snap = await adminDb
    .collection('messageDigests')
    .where('status', '==', 'pending')
    .limit(CRON_BATCH_LIMIT)
    .get()

  for (const doc of snap.docs) {
    scanned += 1
    const data = doc.data() as MessageDigest
    const count = Number(data.pendingCount ?? 0)
    if (!data.requestId || !data.recipientUid || count <= 0) continue

    const lastSentAt = toDate(data.lastSentAt)
    if (lastSentAt && Date.now() - lastSentAt.getTime() < MESSAGE_DIGEST_COOLDOWN_MS) continue

    const categoryName = cleanString(data.categoryName, 'your request')
    const senderName = cleanString(data.senderName, 'Someone')
    const requestUrl = appUrl(data.recipientRole === 'pro'
      ? `/pro/messages/${data.requestId}`
      : `/messages/${data.requestId}`)
    const subject = digestSubject({ count, categoryName })

    await sendLifecycleEmail({
      to: cleanString(data.recipientEmail),
      event: 'message.digest',
      requestId: data.requestId,
      subject,
      previewText: count > 1
        ? `${senderName} and the latest message are waiting in Mestermind.`
        : `${senderName}: ${cleanString(data.lastMessage).slice(0, 120)}`,
      text: [
        count > 1
          ? `You have ${count} new messages about ${categoryName}.`
          : `You have a new message about ${categoryName}.`,
        `${senderName}: ${cleanString(data.lastMessage)}`,
        `Open Mestermind to reply: ${requestUrl}`,
      ].join('\n\n'),
      bodyHtml: emailCardHtml({
        eyebrow: 'New messages',
        title: subject,
        intro: 'Open Mestermind to keep the conversation moving.',
        rows: [
          ['From', senderName],
          ['Latest message', data.lastMessage],
        ],
        ctaLabel: 'Open conversation',
        ctaUrl: requestUrl,
        tone: 'slate',
      }),
      hideSubjectHeading: true,
      metadata: {
        digestId: doc.id,
        recipientUid: data.recipientUid,
        recipientRole: data.recipientRole,
        lastSenderUid: data.lastSenderUid,
        lastSenderRole: data.lastSenderRole,
        pendingCount: count,
        proUid: data.proUid,
        customerUid: data.customerUid,
      },
    })

    await doc.ref.set({
      pendingCount: 0,
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
      lastSentAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    sent += 1
  }

  return Response.json({ ok: true, scanned, sent })
}

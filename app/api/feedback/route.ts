import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { sendAdminNotification } from '@/firebase/adminNotifications'
import { enforceRateLimit, ipRateLimit, userRateLimit } from '@/lib/rateLimit'

type FeedbackType = 'problem' | 'feature' | 'general'

const feedbackTypes = new Set<FeedbackType>(['problem', 'feature', 'general'])

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanFeedbackType(value: unknown): FeedbackType {
  return feedbackTypes.has(value as FeedbackType) ? (value as FeedbackType) : 'general'
}

function cleanOptionalEmail(value: unknown): string {
  const email = cleanString(value).toLowerCase()
  return email.includes('@') && email.length <= 254 ? email : ''
}

async function getOptionalUser(request: NextRequest) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null

  try {
    return await adminAuth.verifyIdToken(header.slice(7))
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getOptionalUser(request)
    const limited = await enforceRateLimit(
      user ? userRateLimit('authWrite', user.uid) : ipRateLimit('expensive', request),
    )
    if (limited) return limited

    const body = await request.json()
    const type = cleanFeedbackType(body.type)
    const message = cleanString(body.message)
    const path = cleanString(body.path, '/').slice(0, 512)
    const email = cleanOptionalEmail(body.email)

    if (message.length < 10) {
      return Response.json({ error: 'Please include at least a sentence of feedback.' }, { status: 400 })
    }

    if (message.length > 2000) {
      return Response.json({ error: 'Please keep feedback under 2,000 characters.' }, { status: 400 })
    }

    const ref = await adminDb.collection('feedback').add({
      type,
      message,
      path,
      status: 'new',
      source: 'feedback_fab',
      email: user?.email ?? email,
      userUid: user?.uid ?? null,
      userName: user?.name ?? null,
      userAgent: request.headers.get('user-agent') ?? '',
      referrer: request.headers.get('referer') ?? '',
      viewport: cleanString(body.viewport).slice(0, 64),
      createdAt: FieldValue.serverTimestamp(),
    })

    if (type === 'problem') {
      await sendAdminNotification({
        event: 'admin.feedback.problem_created',
        subject: `Problem feedback: ${path}`,
        previewText: `A user reported a product problem on ${path}.`,
        text: [
          'A user submitted problem feedback.',
          `Path: ${path}`,
          `Reporter: ${user?.name ?? 'Anonymous'} (${user?.email ?? (email || 'no email')})`,
          `Viewport: ${cleanString(body.viewport).slice(0, 64) || 'Not provided'}`,
          `Message:\n${message}`,
        ].join('\n\n'),
        actionPath: '/admin/feedback',
        metadata: {
          feedbackId: ref.id,
          type,
          userUid: user?.uid ?? null,
          path,
        },
      })
    }

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[/api/feedback POST]', err)
    return Response.json({ error: 'Could not send feedback.' }, { status: 500 })
  }
}

import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { sendEmail } from '@/firebase/email'

const TEST_FROM = 'Mestermind <hello@mestermind.com>'

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanEmail(value: unknown): string {
  const email = cleanString(value).toLowerCase()
  return email.includes('@') && email.length <= 254 ? email : ''
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const to = cleanEmail(body.to)
    const subject = cleanString(body.subject, 'Mestermind test email')
    const message = cleanString(body.message, 'This is a test email from the Mestermind admin panel.')

    if (!to) {
      return Response.json({ error: 'Enter a valid recipient email.' }, { status: 400 })
    }

    const result = await sendEmail({
      from: TEST_FROM,
      to,
      subject,
      text: message,
    })

    await adminDb.collection('mailEvents').add({
      to,
      subject,
      text: message,
      event: 'admin.test_email',
      requestId: null,
      metadata: {
        sentBy: admin.uid,
        sentByEmail: admin.email ?? null,
        from: TEST_FROM,
      },
      status: 'sent',
      error: null,
      provider: 'resend',
      providerId: result.id ?? null,
      createdAt: FieldValue.serverTimestamp(),
    })

    return Response.json({ ok: true, id: result.id ?? null, from: TEST_FROM })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/test-email POST]', err)
    return Response.json({ error: err instanceof Error ? err.message : 'Could not send test email.' }, { status: 500 })
  }
}

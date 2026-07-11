import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { emailConfigured, sendEmail } from '@/firebase/email'
import { defaultLocale, getSupportedLocale, type Locale } from '@/lib/i18n/config'
import { emailRateLimit, enforceRateLimits, ipRateLimit } from '@/lib/rateLimit'

type MailStatus = 'sent' | 'skipped' | 'error'

const RESET_EMAIL: Record<Locale, {
  subject: string
  intro: string
  instruction: string
  cta: string
  ignore: string
  preview: string
}> = {
  en: {
    subject: 'Reset your Mestermind password',
    intro: 'We received a request to reset your Mestermind password.',
    instruction: 'Use the button below to choose a new password.',
    cta: 'Reset password',
    ignore: 'If you did not request this, you can ignore this email.',
    preview: 'Use this secure link to reset your Mestermind password.',
  },
  hu: {
    subject: 'Állítsd vissza a Mestermind jelszavad',
    intro: 'Kérést kaptunk a Mestermind jelszavad visszaállítására.',
    instruction: 'Az alábbi gombbal választhatsz új jelszót.',
    cta: 'Jelszó visszaállítása',
    ignore: 'Ha nem te kérted ezt, nyugodtan figyelmen kívül hagyhatod ezt az e-mailt.',
    preview: 'Ezzel a biztonságos linkkel visszaállíthatod a Mestermind jelszavad.',
  },
}

function appOrigin(request: NextRequest): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin)

  return origin.replace(/\/$/, '')
}

function cleanEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return email.includes('@') && email.length <= 254 ? email : ''
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function firebaseErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    return err.code
  }
  return ''
}

function appResetLink(generatedLink: string, origin: string): string {
  const candidates = [new URL(generatedLink)]

  for (const candidate of candidates) {
    const nestedLink = candidate.searchParams.get('link')
    if (nestedLink) {
      candidates.push(new URL(nestedLink))
    }

    const mode = candidate.searchParams.get('mode')
    const oobCode = candidate.searchParams.get('oobCode')
    if (mode && oobCode) {
      const resetUrl = new URL('/login/reset', origin)
      resetUrl.searchParams.set('mode', mode)
      resetUrl.searchParams.set('oobCode', oobCode)

      const apiKey = candidate.searchParams.get('apiKey')
      if (apiKey) resetUrl.searchParams.set('apiKey', apiKey)

      return resetUrl.toString()
    }
  }

  return generatedLink
}

async function recordEmail(input: {
  to: string
  locale: Locale
  status: MailStatus
  resetUrl?: string
  error?: string
  providerId?: string
}) {
  const copy = RESET_EMAIL[input.locale]
  await adminDb.collection('mailEvents').add({
    to: input.to,
    subject: copy.subject,
    text: 'Password reset request',
    locale: input.locale,
    event: 'auth.password_reset',
    requestId: null,
    metadata: {
      resetUrl: input.resetUrl ?? null,
    },
    status: input.status,
    error: input.error ?? null,
    provider: 'resend',
    providerId: input.providerId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  })
}

async function preferredLocaleForEmail(email: string): Promise<Locale> {
  const user = await adminAuth.getUserByEmail(email).catch(() => null)
  if (!user) return defaultLocale

  const snap = await adminDb.collection('users').doc(user.uid).get()
  if (!snap.exists) return defaultLocale
  return getSupportedLocale(snap.data()?.preferredLocale as string | undefined)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = cleanEmail(body?.email)

  if (!email) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }

  const limited = await enforceRateLimits([
    emailRateLimit('passwordResetEmail', email),
    ipRateLimit('passwordResetIp', request),
  ])
  if (limited) return limited

  if (!emailConfigured()) {
    return Response.json({ error: 'Password reset email is not configured.' }, { status: 503 })
  }

  try {
    const origin = appOrigin(request)
    const locale = await preferredLocaleForEmail(email)
    const copy = RESET_EMAIL[locale]
    const generatedLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${origin}/login/reset`,
      handleCodeInApp: true,
    })
    const resetUrl = appResetLink(generatedLink, origin)
    const text = [
      copy.intro,
      '',
      `${copy.cta}: ${resetUrl}`,
      '',
      copy.ignore,
    ].join('\n')
    const result = await sendEmail({
      to: email,
      subject: copy.subject,
      text,
      bodyHtml: `
        <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">${escapeHtml(copy.intro)}</p>
        <p style="margin:0 0 20px;color:#334155;font-size:16px;line-height:1.6;">${escapeHtml(copy.instruction)}</p>
        <p style="margin:0 0 20px;">
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:11px 24px;border-radius:6px;background:#0ea5e9;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">${escapeHtml(copy.cta)}</a>
        </p>
        <p style="margin:0;color:#676d73;font-size:14px;line-height:22px;">${escapeHtml(copy.ignore)}</p>
      `,
      previewText: copy.preview,
      hideSubjectHeading: true,
      locale,
    })

    await recordEmail({ to: email, locale, status: 'sent', resetUrl, providerId: result.id })
  } catch (err: unknown) {
    const code = firebaseErrorCode(err)
    if (code === 'auth/user-not-found') {
      await recordEmail({ to: email, locale: defaultLocale, status: 'skipped', error: 'No Firebase user for email' })
      return Response.json({ ok: true })
    }

    await recordEmail({
      to: email,
      locale: defaultLocale,
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown password reset error',
    })
    console.error('[/api/auth/password-reset POST]', err)
    return Response.json({ error: 'Could not send password reset email.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}

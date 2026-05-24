import { adminDb } from '@/firebase/admin'

export const CRON_BATCH_LIMIT = 100

export function requireCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'CRON_SECRET is not configured.' }, { status: 401 })
  }

  const expected = `Bearer ${secret}`
  if (request.headers.get('authorization') !== expected) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  return null
}

export function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

export function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return null
}

export async function proEmail(proUid?: string): Promise<string> {
  if (!proUid) return ''
  const snap = await adminDb.collection('pros').doc(proUid).collection('private').doc('account').get()
  return cleanString(snap.data()?.email)
}

export function emailCardHtml(input: {
  eyebrow: string
  title: string
  intro?: string
  rows?: Array<[string, string | undefined | null]>
  ctaLabel: string
  ctaUrl: string
  tone?: 'orange' | 'green' | 'slate'
}): string {
  const tone = input.tone ?? 'orange'
  const accent = tone === 'green' ? '#16a34a' : tone === 'slate' ? '#475569' : '#f97316'
  const heroBg = tone === 'green' ? '#ecfdf5' : tone === 'slate' ? '#f8fafc' : '#fff7ed'
  const border = tone === 'green' ? '#bbf7d0' : tone === 'slate' ? '#e2e8f0' : '#f1d8c7'
  const rows = (input.rows ?? [])
    .filter(([, value]) => cleanString(value))
    .map(([label, value]) => `
      <tr>
        <td style="padding:16px 0;border-top:1px solid #e9eced;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">${escapeEmailHtml(label)}</div>
          <div style="margin-top:4px;font-size:15px;line-height:23px;color:#676d73;white-space:pre-line;">${escapeEmailHtml(cleanString(value))}</div>
        </td>
      </tr>
    `)
    .join('')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:${heroBg};border-radius:4px 4px 0 0;border-bottom:1px solid ${border};text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">${escapeEmailHtml(input.eyebrow)}</div>
          ${input.intro ? `<div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">${escapeEmailHtml(input.intro)}</div>` : ''}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td style="padding:0 0 18px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.title)}</h1>
        </td>
      </tr>
    </table>

    ${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>` : ''}

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.ctaUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">${escapeEmailHtml(input.ctaLabel)}</a>
        </td>
      </tr>
    </table>
  `
}


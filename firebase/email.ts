import { Resend } from 'resend'
import { defaultLocale, type Locale } from '@/lib/i18n/config'

type SendEmailInput = {
  to: string
  subject: string
  text: string
  bodyHtml?: string
  hideSubjectHeading?: boolean
  previewText?: string
  from?: string
  replyTo?: string
  locale?: Locale
}

let resendClient: Resend | null = null
const DEFAULT_FROM_EMAIL = 'Mestermind <hello@mestermind.com>'

const EMAIL_FOOTER: Record<Locale, string> = {
  en: 'This email was sent by Mestermind. If you were not expecting it, you can ignore this message.',
  hu: 'Ezt az e-mailt a Mestermind küldte. Ha nem számítottál rá, nyugodtan figyelmen kívül hagyhatod.',
}

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  resendClient ??= new Resend(apiKey)
  return resendClient
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return '<p style="margin:0;color:#334155;">No message content.</p>'

  return paragraphs
    .map(paragraph => {
      const body = escapeHtml(paragraph).replaceAll('\n', '<br />')
      return `<p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">${body}</p>`
    })
    .join('')
}

function wrapMestermindEmail(input: Pick<SendEmailInput, 'subject' | 'text' | 'bodyHtml' | 'hideSubjectHeading' | 'previewText' | 'locale'>): string {
  const locale = input.locale ?? defaultLocale
  const preview = escapeHtml(input.previewText ?? input.subject)
  const subject = escapeHtml(input.subject)
  const footer = escapeHtml(EMAIL_FOOTER[locale])
  const body = input.bodyHtml ?? textToHtml(input.text)
  const heading = input.hideSubjectHeading
    ? ''
    : `<h1 style="margin:0 0 18px;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${subject}</h1>`

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:#fafafa;font-family:Helvetica,Arial,sans-serif;color:#2f3033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafafa;margin:0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto 12px;">
            <tr>
              <td align="center" style="padding:0 0 16px;">
                <table role="presentation" cellspacing="0" cellpadding="0" align="center">
                  <tr>
                    <td style="font-size:24px;line-height:1;font-weight:800;letter-spacing:-0.03em;color:#111827;">
                      mester<span style="color:#0ea5e9;">mind</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border:1px solid #e9eced;border-radius:6px;overflow:hidden;">
            <tr>
              <td style="padding:24px 20px 20px;">
                ${heading}
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;background:#fafafa;border-top:1px solid #e9eced;">
                <p style="margin:0;color:#676d73;font-size:12px;line-height:18px;text-align:center;">
                  ${footer}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function sendEmail(input: SendEmailInput): Promise<{ id?: string }> {
  const resend = getResendClient()
  if (!resend) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const from = input.from ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: wrapMestermindEmail(input),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  })

  if (error) {
    throw new Error(error.message)
  }

  return { id: data?.id }
}

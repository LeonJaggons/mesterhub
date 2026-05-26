import { sendLifecycleEmail } from './notifications'

type AdminNotificationInput = {
  event: string
  subject: string
  text: string
  previewText?: string
  actionPath?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

function adminEmails(): string[] {
  return (process.env.MESTERHUB_ADMIN_EMAILS ?? '')
    .split(',')
    .map(email => email.trim())
    .filter(email => email.includes('@'))
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

export async function sendAdminNotification(input: AdminNotificationInput): Promise<void> {
  const recipients = adminEmails()
  if (recipients.length === 0) {
    console.warn(`[admin notification] No MESTERHUB_ADMIN_EMAILS configured for ${input.event}`)
    return
  }

  const actionUrl = input.actionPath ? appUrl(input.actionPath) : ''
  const text = [
    input.text,
    actionUrl ? `Open in admin: ${actionUrl}` : '',
  ].filter(Boolean).join('\n\n')

  await Promise.all(recipients.map(to => sendLifecycleEmail({
    to,
    event: input.event,
    subject: input.subject,
    previewText: input.previewText,
    text,
    requestId: input.requestId,
    metadata: {
      audience: 'admin',
      ...(input.actionPath ? { actionPath: input.actionPath } : {}),
      ...(input.metadata ?? {}),
    },
  })))
}

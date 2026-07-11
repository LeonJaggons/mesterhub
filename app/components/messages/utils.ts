import type { Conversation } from '@/firebase/conversations'
import type { Message } from '@/firebase/conversations'
import { timestampMillis, type TimestampLike } from '@/app/requests/shared'
import { initials as partnerInitials, avatarBg as avatarColor } from '@/app/components/ui/Avatar'
import type { createTranslator } from '@/lib/i18n/translator'

export type MessageRole = 'customer' | 'pro'
type Translator = ReturnType<typeof createTranslator>

export function partnerDisplayName(conv: Conversation, role: MessageRole, customerFallback = 'Customer'): string {
  return role === 'customer' ? conv.proName : (conv.customerName || customerFallback)
}

export { partnerInitials, avatarColor }

export function requestHref(requestId: string, role: MessageRole): string {
  return role === 'customer' ? `/requests/${requestId}` : `/pro/jobs/${requestId}`
}

function timestampDate(ts: TimestampLike | null | undefined): Date | null {
  const millis = timestampMillis(ts)
  return millis ? new Date(millis) : null
}

export function formatListTime(ts: TimestampLike | null, locale: string, t: Translator): string {
  const d = timestampDate(ts)
  if (!d) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86400000)

  if (diffDays === 0) {
    return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) return t('messages.time.yesterday')
  if (diffDays < 7) {
    return d.toLocaleDateString(locale, { weekday: 'short' })
  }
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function daySeparatorLabel(ts: TimestampLike | null, locale: string, t: Translator): string {
  const d = timestampDate(ts)
  if (!d) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86400000)

  if (diffDays === 0) return t('messages.time.today')
  if (diffDays === 1) return t('messages.time.yesterday')
  return d.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
}

export type MessageGroup = { dayKey: string; label: string; messages: Message[] }

export function groupMessagesByDay(messages: Message[], locale: string, t: Translator): MessageGroup[] {
  const groups: MessageGroup[] = []
  let currentKey = ''

  for (const msg of messages) {
    const d = timestampDate(msg.createdAt)
    const key = d
      ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      : 'unknown'
    if (key !== currentKey) {
      currentKey = key
      groups.push({
        dayKey: key,
        label: daySeparatorLabel(msg.createdAt, locale, t),
        messages: [msg],
      })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }

  return groups
}

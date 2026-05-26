import type { Conversation } from '@/firebase/conversations'
import type { Message } from '@/firebase/conversations'
import { PRO_AVATAR_COLORS, timestampMillis, type TimestampLike } from '@/app/requests/shared'

export type MessageRole = 'customer' | 'pro'

export function partnerDisplayName(conv: Conversation, role: MessageRole): string {
  return role === 'customer' ? conv.proName : (conv.customerName || 'Customer')
}

export function partnerInitials(name: string): string {
  return (
    name
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

export function avatarColor(name: string): string {
  return PRO_AVATAR_COLORS[name.charCodeAt(0) % PRO_AVATAR_COLORS.length]
}

export function requestHref(requestId: string, role: MessageRole): string {
  return role === 'customer' ? `/requests/${requestId}` : `/pro/jobs/${requestId}`
}

function timestampDate(ts: TimestampLike | null | undefined): Date | null {
  const millis = timestampMillis(ts)
  return millis ? new Date(millis) : null
}

export function formatListTime(ts: TimestampLike | null): string {
  const d = timestampDate(ts)
  if (!d) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86400000)

  if (diffDays === 0) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function daySeparatorLabel(ts: TimestampLike | null): string {
  const d = timestampDate(ts)
  if (!d) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export type MessageGroup = { dayKey: string; label: string; messages: Message[] }

export function groupMessagesByDay(messages: Message[]): MessageGroup[] {
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
        label: daySeparatorLabel(msg.createdAt),
        messages: [msg],
      })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }

  return groups
}

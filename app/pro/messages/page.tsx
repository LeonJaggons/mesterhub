'use client'

import ConversationList from '@/app/components/messages/ConversationList'

export default function ProMessagesPage() {
  return (
    <ConversationList
      role="pro"
      filterField="proUid"
      basePath="/pro/messages"
      loginNext="/pro/messages"
      subtitle="Conversations with customers who hired you."
      emptyTitle="No messages yet"
      emptyBody="When a customer accepts your quote, the conversation will appear here."
      emptyCta={{ href: '/pro/jobs', label: 'View jobs' }}
    />
  )
}

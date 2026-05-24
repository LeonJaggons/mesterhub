'use client'

import ConversationList from '@/app/components/messages/ConversationList'

export default function CustomerMessagesPage() {
  return (
    <ConversationList
      role="customer"
      filterField="customerUid"
      basePath="/messages"
      loginNext="/messages"
      subtitle="Conversations with pros about your projects."
      emptyTitle="No messages yet"
      emptyBody="Accept a quote on a request to start messaging a pro."
      emptyCta={{ href: '/requests', label: 'View my requests' }}
    />
  )
}

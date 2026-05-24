'use client'

import ConversationThread from '@/app/components/messages/ConversationThread'

export default function CustomerConversationPage() {
  return <ConversationThread role="customer" basePath="/messages" />
}

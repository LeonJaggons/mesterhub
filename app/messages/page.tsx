'use client'

import ConversationList from '@/app/components/messages/ConversationList'
import { useTranslations } from '@/lib/i18n/client'

export default function CustomerMessagesPage() {
  const t = useTranslations()
  return (
    <ConversationList
      role="customer"
      filterField="customerUid"
      basePath="/messages"
      loginNext="/messages"
      subtitle={t('messages.customer.subtitle')}
      emptyTitle={t('messages.customer.emptyTitle')}
      emptyBody={t('messages.customer.emptyBody')}
      emptyCta={{ href: '/requests', label: t('messages.customer.emptyCta') }}
    />
  )
}

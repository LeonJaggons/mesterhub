'use client'

import ConversationList from '@/app/components/messages/ConversationList'
import { useTranslations } from '@/lib/i18n/client'

export default function ProMessagesPage() {
  const t = useTranslations()
  return (
    <ConversationList
      role="pro"
      filterField="proUid"
      basePath="/pro/messages"
      loginNext="/pro/messages"
      subtitle={t('messages.pro.subtitle')}
      emptyTitle={t('messages.pro.emptyTitle')}
      emptyBody={t('messages.pro.emptyBody')}
      emptyCta={{ href: '/pro/jobs', label: t('messages.pro.emptyCta') }}
    />
  )
}

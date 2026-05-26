'use client'

import { usePathname } from 'next/navigation'
import { getPathnameWithoutLocale } from '@/lib/i18n/config'
import Footer from './Footer'

function isMessagesRoute(pathname: string): boolean {
  return pathname === '/messages'
    || pathname.startsWith('/messages/')
    || pathname === '/pro/messages'
    || pathname.startsWith('/pro/messages/')
}

export default function ConditionalFooter() {
  const pathname = getPathnameWithoutLocale(usePathname())
  if (isMessagesRoute(pathname)) return null
  return <Footer />
}


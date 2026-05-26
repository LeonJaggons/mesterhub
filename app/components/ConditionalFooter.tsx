'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

function isMessagesRoute(pathname: string): boolean {
  return pathname === '/messages'
    || pathname.startsWith('/messages/')
    || pathname === '/pro/messages'
    || pathname.startsWith('/pro/messages/')
}

export default function ConditionalFooter() {
  const pathname = usePathname()
  if (isMessagesRoute(pathname)) return null
  return <Footer />
}


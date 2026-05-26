'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { authenticatedFetch } from '@/firebase/apiClient'

export type ClientNotification = {
  id: string
  type: string
  title: string
  body: string
  href: string
  requestId: string
  createdAt: string | null
  readAt: string | null
}

type NotificationPayload = {
  notifications?: ClientNotification[]
  unreadCount?: number
}

function parsePayload(value: unknown): NotificationPayload {
  if (!value || typeof value !== 'object') return { notifications: [], unreadCount: 0 }
  const payload = value as NotificationPayload
  return {
    notifications: Array.isArray(payload.notifications) ? payload.notifications : [],
    unreadCount: typeof payload.unreadCount === 'number' ? payload.unreadCount : 0,
  }
}

export function useNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const applyPayload = useCallback((payload: NotificationPayload) => {
    setNotifications(payload.notifications ?? [])
    setUnreadCount(payload.unreadCount ?? 0)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let active = true

    async function loadInitial() {
      setLoading(true)
      try {
        const response = await authenticatedFetch('/api/notifications', { signal: controller.signal })
        applyPayload(parsePayload(await response.json()))
      } catch (err) {
        if (!controller.signal.aborted) console.error('[notifications] initial load failed', err)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    async function connectStream() {
      try {
        const response = await authenticatedFetch('/api/notifications/stream', { signal: controller.signal })
        const reader = response.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()
        let buffer = ''
        while (active) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            applyPayload(parsePayload(JSON.parse(line)))
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error('[notifications] stream failed', err)
      } finally {
        if (active && !controller.signal.aborted) {
          reconnectTimer = setTimeout(connectStream, 3000)
        }
      }
    }

    loadInitial()
    connectStream()

    return () => {
      active = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      controller.abort()
    }
  }, [applyPayload, enabled])

  const markRead = useCallback(async (id: string) => {
    setNotifications(current => current.map(notification => (
      notification.id === id && !notification.readAt
        ? { ...notification, readAt: new Date().toISOString() }
        : notification
    )))
    setUnreadCount(count => Math.max(0, count - 1))
    await authenticatedFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
  }, [])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setNotifications(current => current.map(notification => ({ ...notification, readAt: notification.readAt ?? now })))
    setUnreadCount(0)
    await authenticatedFetch('/api/notifications/read-all', { method: 'PATCH' })
  }, [])

  return useMemo(() => ({
    notifications: enabled ? notifications : [],
    unreadCount: enabled ? unreadCount : 0,
    loading: enabled ? loading : false,
    markRead,
    markAllRead,
  }), [enabled, loading, markAllRead, markRead, notifications, unreadCount])
}


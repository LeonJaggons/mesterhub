'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { onAuthChange } from '@/firebase/auth'
import {
  confirmAppointment,
  requestAppointment,
  sendMessage,
  type AppointmentRequestInput,
  type Conversation,
  type Message,
} from '@/firebase/conversations'
import {
  districtLabel,
  formatAnswers,
  timestampMillis,
  type AppointmentKind,
  type ServiceRequest,
} from '@/app/requests/shared'
import { authenticatedFetch } from '@/firebase/apiClient'
import MessageAvatar from './MessageAvatar'
import {
  groupMessagesByDay,
  partnerDisplayName,
  requestHref,
  type MessageRole,
} from './utils'
import ReportUserButton from '@/app/components/reports/ReportUserButton'
import styles from './messages.module.css'
import { useLocale, useTranslations } from '@/lib/i18n/client'
import { translateCategory } from '@/lib/i18n/taxonomy'

type Translator = ReturnType<typeof useTranslations>

type Props = {
  role: MessageRole
  basePath: string
}

function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 20.4l17.45-7.56c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.89c-.5.07-.87.5-.87 1l.01 4.6c0 .71.73 1.2 1.39.91z" />
    </svg>
  )
}

function detailValue(t: Translator, value?: string | null): string {
  return value && value.trim() ? value : t('messages.thread.notShared')
}

function formatAppointmentDateTime(date: string, time: string, locale: string, t: Translator): string {
  if (!date || !time) return [date, time].filter(Boolean).join(` ${t('messages.common.at')} `)
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} ${t('messages.common.at')} ${time}`
  return parsed.toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function timeAgo(t: Translator, ts: ServiceRequest['createdAt']): string {
  const millis = timestampMillis(ts)
  if (!millis) return ''
  const seconds = Math.floor((Date.now() - millis) / 1000)
  if (seconds < 60) return t('customerRequests.time.justNow')
  if (seconds < 3600) return t('customerRequests.time.minutesAgo', { count: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('customerRequests.time.hoursAgo', { count: Math.floor(seconds / 3600) })
  return t('customerRequests.time.daysAgo', { count: Math.floor(seconds / 86400) })
}

function optionKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function translatedDetails(t: Translator, request: ServiceRequest) {
  return formatAnswers(request.answers).map(item => ({
    key: t(`projects.answers.keys.${optionKey(item.key)}`, { defaultValue: item.key }),
    value: t(`projects.answers.values.${optionKey(item.value)}`, { defaultValue: item.value }),
  }))
}

function conversationStatusLabel(t: Translator, request: ServiceRequest, role: MessageRole): string {
  if (request.status === 'declined' && request.declinedBy === 'customer') {
    return role === 'customer' ? t('customerRequests.status.youDeclined') : t('messages.thread.status.declinedByCustomer')
  }
  if (request.status === 'declined' && request.declinedBy === 'pro') {
    return role === 'pro' ? t('customerRequests.status.youDeclined') : t('customerRequests.status.declinedByPro')
  }
  return t(`customerRequests.status.${request.status}`)
}

function RoleChecklist({ role, partnerName }: { role: MessageRole; partnerName: string }) {
  const t = useTranslations()
  const items = role === 'customer'
    ? [
        t('messages.thread.checklist.customerConfirm', { name: partnerName }),
        t('messages.thread.checklist.customerAccess'),
        t('messages.thread.checklist.customerScope'),
      ]
    : [
        t('messages.thread.checklist.proAddress'),
        t('messages.thread.checklist.proCosts'),
        t('messages.thread.checklist.proNextSteps'),
      ]

  return (
    <ul className={styles.tipList}>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function AppointmentModal({
  customerName,
  request,
  onClose,
  onSubmit,
}: {
  customerName: string
  request: ServiceRequest | null
  onClose: () => void
  onSubmit: (input: AppointmentRequestInput) => Promise<void>
}) {
  const t = useTranslations()
  const existingAppointment = request?.appointmentChangeRequest ?? request?.appointmentRequest
  const [kind, setKind] = useState<AppointmentKind>(
    existingAppointment?.kind ?? (request?.status === 'accepted' ? 'service' : 'quote')
  )
  const [date, setDate] = useState(existingAppointment?.date ?? '')
  const [time, setTime] = useState(existingAppointment?.time ?? '')
  const [duration, setDuration] = useState(existingAppointment?.duration ?? '60 minutes')
  const [location, setLocation] = useState(existingAppointment?.location ?? request?.acceptance?.address ?? '')
  const [notes, setNotes] = useState(existingAppointment?.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time) {
      setError(t('messages.appointmentModal.errors.dateTime'))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await onSubmit({
        kind,
        date,
        time,
        duration,
        location,
        notes,
      })
    } catch {
      setError(t('messages.appointmentModal.errors.send'))
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalPanel} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.asideKicker}>{t('messages.appointmentModal.kicker')}</p>
            <h2 className={styles.modalTitle}>{t('messages.appointmentModal.title', { name: customerName })}</h2>
            <p className={styles.modalSubtitle}>{t('messages.appointmentModal.subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className={styles.modalClose} aria-label={t('messages.common.close')}>
            ×
          </button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <fieldset className={styles.appointmentChoices}>
            <legend>{t('messages.appointmentModal.type')}</legend>
            {[
              { id: 'quote' as AppointmentKind, label: t('messages.appointmentModal.quoteVisit'), body: t('messages.appointmentModal.quoteVisitBody') },
              { id: 'service' as AppointmentKind, label: t('messages.appointmentModal.serviceAppointment'), body: t('messages.appointmentModal.serviceAppointmentBody') },
            ].map(option => (
              <label key={option.id} className={kind === option.id ? styles.choiceSelected : styles.choice}>
                <input
                  type="radio"
                  name="appointment-kind"
                  value={option.id}
                  checked={kind === option.id}
                  onChange={() => setKind(option.id)}
                />
                <span>{option.label}</span>
                <small>{option.body}</small>
              </label>
            ))}
          </fieldset>

          <div className={styles.modalGrid}>
            <label>
              {t('messages.appointmentModal.date')}
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <label>
              {t('messages.appointmentModal.time')}
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </label>
            <label>
              {t('messages.appointmentModal.duration')}
              <select value={duration} onChange={e => setDuration(e.target.value)}>
                {[
                  { value: '30 minutes', label: t('messages.appointmentModal.durations.30') },
                  { value: '60 minutes', label: t('messages.appointmentModal.durations.60') },
                  { value: '90 minutes', label: t('messages.appointmentModal.durations.90') },
                  { value: '2 hours', label: t('messages.appointmentModal.durations.2h') },
                  { value: 'Half day', label: t('messages.appointmentModal.durations.halfDay') },
                  { value: 'Full day', label: t('messages.appointmentModal.durations.fullDay') },
                ].map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            {t('messages.appointmentModal.location')}
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={t('messages.appointmentModal.locationPlaceholder')}
            />
          </label>

          <label>
            {t('messages.appointmentModal.message')}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder={t('messages.appointmentModal.messagePlaceholder')}
            />
          </label>

          {error && <p className={styles.modalError}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>{t('messages.common.cancel')}</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting || !date || !time}>
              {submitting ? t('messages.appointmentModal.sending') : t('messages.appointmentModal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ConversationThread({ role, basePath }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const params = useParams()
  const requestId = params.requestId as string
  const loginNext = `${basePath}/${requestId}`
  const [conv, setConv] = useState<Conversation | null>(null)
  const [request, setRequest] = useState<ServiceRequest | null>(null)
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [userUid, setUserUid] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showAppointmentModal, setShowAppointmentModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    return onAuthChange(user => {
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(loginNext)}`)
        return
      }
      setUserUid(user.uid)
    })
  }, [router, loginNext])

  useEffect(() => {
    if (!userUid) return

    let active = true

    async function loadConversation() {
      try {
        const response = await authenticatedFetch(`/api/conversations/${requestId}?role=${role}`)
        const payload = (await response.json()) as {
          conversation?: Conversation | null
          request?: ServiceRequest | null
          messages?: Message[]
          partnerAvatarUrl?: string | null
        }
        if (!active) return

        if (!payload.conversation) {
          setConv(null)
          setRequest(null)
          setMessages([])
          setLoading(false)
          return
        }

        const data = payload.conversation
        if (data.customerUid !== userUid && data.proUid !== userUid) {
          setConv(null)
          setRequest(null)
          setMessages([])
          setLoading(false)
          return
        }

        setConv(data)
        setRequest(payload.request ?? null)
        setMessages(payload.messages ?? [])
        setPartnerAvatarUrl(role === 'customer' ? (payload.partnerAvatarUrl ?? null) : null)
      } catch {
        if (active) {
          setConv(null)
          setRequest(null)
          setMessages([])
          setPartnerAvatarUrl(null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadConversation()
    const interval = window.setInterval(loadConversation, 5000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [requestId, role, userUid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function resizeComposer() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    if (!userUid || !conv || !text.trim() || sending) return
    setSending(true)
    try {
      const senderRole = conv.customerUid === userUid ? 'customer' : 'pro'
      await sendMessage(requestId, userUid, senderRole, text)
      setText('')
      const response = await authenticatedFetch(`/api/conversations/${requestId}?role=${role}`)
      const payload = (await response.json()) as { messages?: Message[] }
      setMessages(payload.messages ?? [])
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleAppointmentSubmit(input: AppointmentRequestInput) {
    if (!userUid || !request) return
    const isChangeRequest = request.appointmentRequest?.status === 'confirmed'
    await requestAppointment(requestId, userUid, input, { isChangeRequest })
    const proposedAppointment = {
      ...input,
      location: input.location ?? '',
      jobLocation: request.jobLocation ?? null,
      notes: input.notes ?? '',
      status: 'proposed' as const,
      requestedAt: null,
    }
    setRequest({
      ...request,
      ...(isChangeRequest
        ? { appointmentChangeRequest: proposedAppointment }
        : { appointmentRequest: proposedAppointment }),
    })
    setShowAppointmentModal(false)
  }

  async function handleConfirmAppointment() {
    if (!userUid || (!request?.appointmentRequest && !request?.appointmentChangeRequest)) return
    await confirmAppointment(requestId, userUid)
    if (request.appointmentChangeRequest) {
      const { appointmentChangeRequest: changeRequest, ...rest } = request
      setRequest({
        ...rest,
        appointmentRequest: {
          ...changeRequest,
          status: 'confirmed',
          confirmedAt: null,
        },
      })
    } else if (request.appointmentRequest) {
      setRequest({
        ...request,
        appointmentRequest: {
          ...request.appointmentRequest,
          status: 'confirmed',
          confirmedAt: null,
        },
      })
    }
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <div className={styles.centered}>
          <p className={styles.centeredText}>{t('messages.thread.loading')}</p>
        </div>
      </div>
    )
  }

  if (!conv) {
    return (
      <div className={styles.shell}>
        <div className={styles.centered}>
          <p className={styles.centeredTitle}>{t('messages.thread.notFound')}</p>
          <Link href={basePath} className={styles.ctaBtn}>
            {t('messages.thread.backToMessages')}
          </Link>
        </div>
      </div>
    )
  }

  const name = partnerDisplayName(conv, role, t('messages.thread.customerFallback'))
  const reportTargetUid = role === 'customer' ? conv.proUid : conv.customerUid
  const reportTargetRole = role === 'customer' ? 'pro' : 'customer'
  const groups = groupMessagesByDay(messages, locale, t)
  const details = request ? translatedDetails(t, request) : []
  const statusLabel = request ? conversationStatusLabel(t, request, role) : t('messages.thread.conversationOpen')
  const requestStarted = request?.createdAt ? timeAgo(t, request.createdAt) : ''
  const district = request?.customerDistrict ? districtLabel(request.customerDistrict) : ''
  const quote = request?.quote
  const acceptance = request?.acceptance

  return (
    <div className={styles.shell}>
      <div className={styles.threadLayout}>
        <section className={styles.chatPane}>
          <header className={styles.threadHeader}>
            <Link href={basePath} className={styles.backBtn} aria-label={t('messages.thread.back')}>
              <ChevronLeft />
            </Link>
            <MessageAvatar name={name} imageUrl={partnerAvatarUrl} size="sm" />
            <div className={styles.headerCenter}>
              <p className={styles.headerName}>{name}</p>
              <p className={styles.headerSub}>{translateCategory(t, conv.categoryName)} · {statusLabel}</p>
            </div>
            <Link href={requestHref(requestId, role)} className={styles.headerAction}>
              {role === 'customer' ? t('messages.thread.openRequest') : t('messages.thread.openJob')}
            </Link>
            <ReportUserButton
              targetUid={reportTargetUid}
              targetRole={reportTargetRole}
              targetName={name}
              reporterRole={role}
              contextType="conversation"
              requestId={requestId}
              buttonLabel={t('messages.thread.report')}
              className={styles.headerReportAction}
            />
          </header>

          <div className={styles.messageArea}>
            {messages.length === 0 ? (
              <div className={styles.emptyThread}>
                {t('messages.thread.emptyThread')}
              </div>
            ) : (
              groups.map(group => (
                <div key={group.dayKey}>
                  <div className={styles.dayLabel}>{group.label}</div>
                  {group.messages.map(msg => {
                    const mine = msg.senderUid === userUid
                    return (
                      <div
                        key={msg.id}
                        className={`${styles.row} ${mine ? styles.rowMine : styles.rowTheirs}`}
                      >
                        <div
                          className={`${styles.bubble} ${mine ? styles.bubbleMine : styles.bubbleTheirs}`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form className={styles.composer} onSubmit={handleSend}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => {
                setText(e.target.value)
                resizeComposer()
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('messages.thread.messagePlaceholder', { name })}
              rows={1}
              className={styles.composerField}
              aria-label={t('messages.thread.messageAria')}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className={styles.sendBtn}
              aria-label={t('messages.thread.send')}
            >
              <SendIcon />
            </button>
          </form>
        </section>

        <aside className={styles.contextPane}>
          <div className={styles.profileCard}>
            <MessageAvatar name={name} imageUrl={partnerAvatarUrl} />
            <div>
              <p className={styles.profileName}>{name}</p>
              <p className={styles.profileMeta}>
                {role === 'customer'
                  ? t('messages.thread.profileProFor', { category: translateCategory(t, conv.categoryName) })
                  : t('messages.thread.profileCustomerFor', { category: translateCategory(t, conv.categoryName) })}
              </p>
            </div>
          </div>

          {role === 'pro' && (
            <div className={styles.asideCard}>
              <p className={styles.asideKicker}>{t('messages.thread.primaryAction')}</p>
              <h2 className={styles.asideTitle}>{t('messages.thread.scheduleAppointment')}</h2>
              {request?.appointmentChangeRequest && (
                <div className={styles.appointmentSummary}>
                  <span>{t('messages.thread.pendingChangeRequest')}</span>
                  <strong>
                    {formatAppointmentDateTime(
                      request.appointmentChangeRequest.date,
                      request.appointmentChangeRequest.time,
                      locale,
                      t
                    )}
                  </strong>
                  <small>{request.appointmentChangeRequest.duration}</small>
                </div>
              )}
              {request?.appointmentRequest ? (
                <div className={styles.appointmentSummary}>
                  <span>{request.appointmentRequest.kind === 'quote' ? t('messages.appointmentModal.quoteVisit') : t('messages.appointmentModal.serviceAppointment')}</span>
                  <strong>
                    {formatAppointmentDateTime(
                      request.appointmentRequest.date,
                      request.appointmentRequest.time,
                      locale,
                      t
                    )}
                  </strong>
                  <small>{request.appointmentRequest.duration}</small>
                </div>
              ) : (
                <p className={styles.asideText}>
                  {t('messages.thread.proposeTime')}
                </p>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setShowAppointmentModal(true)}
              >
                {request?.appointmentRequest ? t('messages.thread.updateAppointment') : t('messages.thread.scheduleAppointment')}
              </button>
            </div>
          )}

          {role === 'customer' && request?.appointmentChangeRequest && (
            <div className={`${styles.asideCard} ${styles.confirmAppointmentCard}`}>
              <p className={styles.asideKicker}>{t('messages.thread.appointmentChangeRequest')}</p>
              <h2 className={styles.asideTitle}>{t('messages.thread.approveNewTime')}</h2>
              <div className={styles.appointmentSummary}>
                <span>{request.appointmentChangeRequest.kind === 'quote' ? t('messages.appointmentModal.quoteVisit') : t('messages.appointmentModal.serviceAppointment')}</span>
                <strong>
                  {formatAppointmentDateTime(
                    request.appointmentChangeRequest.date,
                    request.appointmentChangeRequest.time,
                    locale,
                    t
                  )}
                </strong>
                <small>{request.appointmentChangeRequest.duration}</small>
                {request.appointmentChangeRequest.location && (
                  <small>{request.appointmentChangeRequest.location}</small>
                )}
              </div>
              {request.appointmentChangeRequest.notes && (
                <p className={styles.asideText}>{request.appointmentChangeRequest.notes}</p>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleConfirmAppointment}
              >
                {t('messages.thread.approveChange')}
              </button>
            </div>
          )}

          {role === 'customer' && request?.appointmentRequest && (
            <div className={`${styles.asideCard} ${styles.confirmAppointmentCard}`}>
              <p className={styles.asideKicker}>{t('messages.thread.appointmentRequest')}</p>
              <h2 className={styles.asideTitle}>
                {request.appointmentRequest.status === 'confirmed' ? t('messages.thread.appointmentConfirmed') : t('messages.thread.confirmAppointment')}
              </h2>
              <div className={styles.appointmentSummary}>
                <span>{request.appointmentRequest.kind === 'quote' ? t('messages.appointmentModal.quoteVisit') : t('messages.appointmentModal.serviceAppointment')}</span>
                <strong>
                  {formatAppointmentDateTime(
                    request.appointmentRequest.date,
                    request.appointmentRequest.time,
                    locale,
                    t
                  )}
                </strong>
                <small>{request.appointmentRequest.duration}</small>
                {request.appointmentRequest.location && (
                  <small>{request.appointmentRequest.location}</small>
                )}
              </div>
              {request.appointmentRequest.notes && (
                <p className={styles.asideText}>{request.appointmentRequest.notes}</p>
              )}
              {request.appointmentRequest.status === 'proposed' && (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleConfirmAppointment}
                >
                  {t('messages.thread.confirmAppointment')}
                </button>
              )}
            </div>
          )}

          <div className={styles.asideCard}>
            <p className={styles.asideKicker}>{role === 'customer' ? t('messages.thread.requestSnapshot') : t('messages.thread.jobSnapshot')}</p>
            <h2 className={styles.asideTitle}>{translateCategory(t, conv.categoryName)}</h2>
            <div className={styles.detailGrid}>
              <div>
                <span>{t('messages.thread.statusLabel')}</span>
                <strong>{statusLabel}</strong>
              </div>
              {requestStarted && (
                <div>
                  <span>{t('messages.thread.started')}</span>
                  <strong>{requestStarted}</strong>
                </div>
              )}
              {district && (
                <div>
                  <span>{t('messages.thread.area')}</span>
                  <strong>{district}</strong>
                </div>
              )}
              {quote?.price && (
                <div>
                  <span>{role === 'customer' ? t('messages.thread.quotedPrice') : t('messages.thread.yourQuote')}</span>
                  <strong>{quote.price}</strong>
                </div>
              )}
              {quote?.timeline && (
                <div>
                  <span>{t('messages.thread.timeline')}</span>
                  <strong>{quote.timeline}</strong>
                </div>
              )}
            </div>
          </div>

          {role === 'pro' && acceptance && (
            <div className={styles.asideCard}>
              <p className={styles.asideKicker}>{t('messages.thread.customerDetails')}</p>
              <h2 className={styles.asideTitle}>{t('messages.thread.usefulWhileReplying')}</h2>
              <div className={styles.detailGrid}>
                <div>
                  <span>{t('messages.thread.phone')}</span>
                  <strong>{detailValue(t, acceptance.phone)}</strong>
                </div>
                <div>
                  <span>{t('messages.thread.address')}</span>
                  <strong>{detailValue(t, acceptance.address)}</strong>
                </div>
                <div>
                  <span>{t('messages.thread.preferredStart')}</span>
                  <strong>{detailValue(t, acceptance.preferredStart)}</strong>
                </div>
              </div>
            </div>
          )}

          <div className={styles.asideCard}>
            <p className={styles.asideKicker}>{t('messages.thread.helpfulPrompts')}</p>
            <h2 className={styles.asideTitle}>
              {role === 'customer' ? t('messages.thread.whatToAskPro') : t('messages.thread.whatToConfirm')}
            </h2>
            <RoleChecklist role={role} partnerName={name} />
          </div>

          {details.length > 0 && (
            <div className={styles.asideCard}>
              <p className={styles.asideKicker}>{t('messages.thread.projectBrief')}</p>
              <div className={styles.briefList}>
                {details.slice(0, 5).map(({ key, value }) => (
                  <div key={key}>
                    <span>{key}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <Link href={requestHref(requestId, role)} className={styles.textLink}>
                {role === 'customer' ? t('messages.thread.viewFullRequest') : t('messages.thread.viewFullJob')}
              </Link>
            </div>
          )}
        </aside>
      </div>
      {showAppointmentModal && (
        <AppointmentModal
          customerName={name}
          request={request}
          onClose={() => setShowAppointmentModal(false)}
          onSubmit={handleAppointmentSubmit}
        />
      )}
    </div>
  )
}

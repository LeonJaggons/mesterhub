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
  requestStatusLabel,
  timeAgo,
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

function detailValue(value?: string | null): string {
  return value && value.trim() ? value : 'Not shared yet'
}

function formatAppointmentDateTime(date: string, time: string): string {
  if (!date || !time) return [date, time].filter(Boolean).join(' at ')
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return `${date} at ${time}`
  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function conversationStatusLabel(request: ServiceRequest, role: MessageRole): string {
  if (request.status === 'declined' && request.declinedBy === 'customer') {
    return role === 'customer' ? 'You declined' : 'Declined by customer'
  }
  if (request.status === 'declined' && request.declinedBy === 'pro') {
    return role === 'pro' ? 'You declined' : 'Declined by pro'
  }
  return requestStatusLabel(request.status, request.declinedBy)
}

function RoleChecklist({ role, partnerName }: { role: MessageRole; partnerName: string }) {
  const items = role === 'customer'
    ? [
        `Ask ${partnerName} to confirm timing, materials, and what is included.`,
        'Share access notes like parking, pets, gate codes, or elevator limits.',
        'Keep scope changes here so the quote and job details stay clear.',
      ]
    : [
        'Confirm the customer address, start window, and any prep needed.',
        'Mention extra costs before the visit, especially materials or parking.',
        'Summarize next steps so the customer knows what happens after this chat.',
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
      setError('Choose a date and time.')
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
      setError('Could not send the appointment request. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalPanel} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.asideKicker}>Appointment request</p>
            <h2 className={styles.modalTitle}>Schedule with {customerName}</h2>
            <p className={styles.modalSubtitle}>Propose a time for a quote visit or the service appointment.</p>
          </div>
          <button type="button" onClick={onClose} className={styles.modalClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <fieldset className={styles.appointmentChoices}>
            <legend>Appointment type</legend>
            {[
              { id: 'quote' as AppointmentKind, label: 'Quote visit', body: 'Inspect the scope before a firm price.' },
              { id: 'service' as AppointmentKind, label: 'Service appointment', body: 'Schedule the actual work.' },
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
              Date
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <label>
              Time
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </label>
            <label>
              Duration
              <select value={duration} onChange={e => setDuration(e.target.value)}>
                {['30 minutes', '60 minutes', '90 minutes', '2 hours', 'Half day', 'Full day'].map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Location or meeting note
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Customer address, district, or video call"
            />
          </label>

          <label>
            Message to customer
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="Mention what you will inspect, what the customer should prepare, and whether this is for the quote or service."
            />
          </label>

          {error && <p className={styles.modalError}>{error}</p>}

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting || !date || !time}>
              {submitting ? 'Sending...' : 'Send appointment request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ConversationThread({ role, basePath }: Props) {
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
          <p className={styles.centeredText}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!conv) {
    return (
      <div className={styles.shell}>
        <div className={styles.centered}>
          <p className={styles.centeredTitle}>Conversation not found</p>
          <Link href={basePath} className={styles.ctaBtn}>
            Back to Messages
          </Link>
        </div>
      </div>
    )
  }

  const name = partnerDisplayName(conv, role)
  const reportTargetUid = role === 'customer' ? conv.proUid : conv.customerUid
  const reportTargetRole = role === 'customer' ? 'pro' : 'customer'
  const groups = groupMessagesByDay(messages)
  const details = request ? formatAnswers(request.answers) : []
  const statusLabel = request ? conversationStatusLabel(request, role) : 'Conversation open'
  const requestStarted = request?.createdAt ? timeAgo(request.createdAt) : ''
  const district = request?.customerDistrict ? districtLabel(request.customerDistrict) : ''
  const quote = request?.quote
  const acceptance = request?.acceptance

  return (
    <div className={styles.shell}>
      <div className={styles.threadLayout}>
        <section className={styles.chatPane}>
          <header className={styles.threadHeader}>
            <Link href={basePath} className={styles.backBtn} aria-label="Back">
              <ChevronLeft />
            </Link>
            <MessageAvatar name={name} imageUrl={partnerAvatarUrl} size="sm" />
            <div className={styles.headerCenter}>
              <p className={styles.headerName}>{name}</p>
              <p className={styles.headerSub}>{conv.categoryName} · {statusLabel}</p>
            </div>
            <Link href={requestHref(requestId, role)} className={styles.headerAction}>
              Open {role === 'customer' ? 'request' : 'job'}
            </Link>
            <ReportUserButton
              targetUid={reportTargetUid}
              targetRole={reportTargetRole}
              targetName={name}
              reporterRole={role}
              contextType="conversation"
              requestId={requestId}
              buttonLabel="Report"
              className={styles.headerReportAction}
            />
          </header>

          <div className={styles.messageArea}>
            {messages.length === 0 ? (
              <div className={styles.emptyThread}>
                Send a message to start the conversation.
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
              placeholder={`Message ${name}`}
              rows={1}
              className={styles.composerField}
              aria-label="Message"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className={styles.sendBtn}
              aria-label="Send"
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
                {role === 'customer' ? 'Your pro' : 'Customer'} for {conv.categoryName}
              </p>
            </div>
          </div>

          {role === 'pro' && (
            <div className={styles.asideCard}>
              <p className={styles.asideKicker}>Primary action</p>
              <h2 className={styles.asideTitle}>Schedule appointment</h2>
              {request?.appointmentChangeRequest && (
                <div className={styles.appointmentSummary}>
                  <span>Pending change request</span>
                  <strong>
                    {formatAppointmentDateTime(
                      request.appointmentChangeRequest.date,
                      request.appointmentChangeRequest.time
                    )}
                  </strong>
                  <small>{request.appointmentChangeRequest.duration}</small>
                </div>
              )}
              {request?.appointmentRequest ? (
                <div className={styles.appointmentSummary}>
                  <span>{request.appointmentRequest.kind === 'quote' ? 'Quote visit' : 'Service appointment'}</span>
                  <strong>
                    {formatAppointmentDateTime(
                      request.appointmentRequest.date,
                      request.appointmentRequest.time
                    )}
                  </strong>
                  <small>{request.appointmentRequest.duration}</small>
                </div>
              ) : (
                <p className={styles.asideText}>
                  Propose a time for a quote visit or the service appointment.
                </p>
              )}
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setShowAppointmentModal(true)}
              >
                {request?.appointmentRequest ? 'Update appointment request' : 'Schedule appointment'}
              </button>
            </div>
          )}

          {role === 'customer' && request?.appointmentChangeRequest && (
            <div className={`${styles.asideCard} ${styles.confirmAppointmentCard}`}>
              <p className={styles.asideKicker}>Appointment change request</p>
              <h2 className={styles.asideTitle}>Approve new time</h2>
              <div className={styles.appointmentSummary}>
                <span>{request.appointmentChangeRequest.kind === 'quote' ? 'Quote visit' : 'Service appointment'}</span>
                <strong>
                  {formatAppointmentDateTime(
                    request.appointmentChangeRequest.date,
                    request.appointmentChangeRequest.time
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
                Approve change
              </button>
            </div>
          )}

          {role === 'customer' && request?.appointmentRequest && (
            <div className={`${styles.asideCard} ${styles.confirmAppointmentCard}`}>
              <p className={styles.asideKicker}>Appointment request</p>
              <h2 className={styles.asideTitle}>
                {request.appointmentRequest.status === 'confirmed' ? 'Appointment confirmed' : 'Confirm appointment'}
              </h2>
              <div className={styles.appointmentSummary}>
                <span>{request.appointmentRequest.kind === 'quote' ? 'Quote visit' : 'Service appointment'}</span>
                <strong>
                  {formatAppointmentDateTime(
                    request.appointmentRequest.date,
                    request.appointmentRequest.time
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
                  Confirm appointment
                </button>
              )}
            </div>
          )}

          <div className={styles.asideCard}>
            <p className={styles.asideKicker}>{role === 'customer' ? 'Request snapshot' : 'Job snapshot'}</p>
            <h2 className={styles.asideTitle}>{conv.categoryName}</h2>
            <div className={styles.detailGrid}>
              <div>
                <span>Status</span>
                <strong>{statusLabel}</strong>
              </div>
              {requestStarted && (
                <div>
                  <span>Started</span>
                  <strong>{requestStarted}</strong>
                </div>
              )}
              {district && (
                <div>
                  <span>Area</span>
                  <strong>{district}</strong>
                </div>
              )}
              {quote?.price && (
                <div>
                  <span>{role === 'customer' ? 'Quoted price' : 'Your quote'}</span>
                  <strong>{quote.price}</strong>
                </div>
              )}
              {quote?.timeline && (
                <div>
                  <span>Timeline</span>
                  <strong>{quote.timeline}</strong>
                </div>
              )}
            </div>
          </div>

          {role === 'pro' && acceptance && (
            <div className={styles.asideCard}>
              <p className={styles.asideKicker}>Customer details</p>
              <h2 className={styles.asideTitle}>Useful while replying</h2>
              <div className={styles.detailGrid}>
                <div>
                  <span>Phone</span>
                  <strong>{detailValue(acceptance.phone)}</strong>
                </div>
                <div>
                  <span>Address</span>
                  <strong>{detailValue(acceptance.address)}</strong>
                </div>
                <div>
                  <span>Preferred start</span>
                  <strong>{detailValue(acceptance.preferredStart)}</strong>
                </div>
              </div>
            </div>
          )}

          <div className={styles.asideCard}>
            <p className={styles.asideKicker}>Helpful prompts</p>
            <h2 className={styles.asideTitle}>
              {role === 'customer' ? 'What to ask the pro' : 'What to confirm'}
            </h2>
            <RoleChecklist role={role} partnerName={name} />
          </div>

          {details.length > 0 && (
            <div className={styles.asideCard}>
              <p className={styles.asideKicker}>Project brief</p>
              <div className={styles.briefList}>
                {details.slice(0, 5).map(({ key, value }) => (
                  <div key={key}>
                    <span>{key}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <Link href={requestHref(requestId, role)} className={styles.textLink}>
                View full {role === 'customer' ? 'request' : 'job'}
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

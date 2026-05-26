import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { createInAppNotification } from '@/firebase/inAppNotifications'
import { hasPaidProFeatures, type SubscriptionPeriodEnd } from '@/lib/billing'

export type MarketplaceQuoteStatus = 'submitted' | 'accepted' | 'declined' | 'withdrawn'

export type MarketplaceQuoteInput = {
  price: string
  timeline: string
  notes: string
}

export type MarketplaceAcceptInput = {
  message: string
  phone?: string
  address?: string
  preferredStart?: string
}

type ProjectDoc = {
  customerUid: string
  customerName?: string
  customerEmail?: string
  categoryName: string
  answers: Record<string, string>
  customerDistrict?: string
  jobLocation?: unknown
  attachmentUrls?: string[]
  invitedProUids?: string[]
  status?: 'active' | 'closed' | 'cancelled'
  createdAt?: unknown
  updatedAt?: unknown
}

type ProDoc = {
  fullName?: string
  categoryName?: string
  districts?: number[]
  status?: string
  profileVisibility?: 'visible' | 'paused'
  subscriptionStatus?: string
  subscriptionCurrentPeriodEnd?: SubscriptionPeriodEnd
}

type MarketplaceQuoteDoc = {
  projectId: string
  proUid: string
  proName: string
  proCategoryName?: string
  customerUid: string
  categoryName: string
  quote: MarketplaceQuoteInput
  status: MarketplaceQuoteStatus
  requestId?: string
  createdAt?: unknown
  updatedAt?: unknown
  quotedAt?: unknown
  acceptedAt?: unknown
  declinedAt?: unknown
}

type FirestoreDoc = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>

const DISTRICT_ROMAN_TO_NUMBER = new Map([
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
  'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII',
].map((roman, index) => [roman, index + 1]))

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function serializeValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  if (Array.isArray(value)) return value.map(serializeValue)
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, serializeValue(nested)]),
  )
}

function serializeDoc(doc: FirestoreDoc): { id: string } & Record<string, unknown> {
  return {
    id: doc.id,
    ...serializeValue(doc.data()) as Record<string, unknown>,
  }
}

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  const timestamp = value as { toMillis?: () => number }
  return typeof timestamp.toMillis === 'function' ? timestamp.toMillis() : 0
}

function districtNumber(value?: string): number | null {
  if (!value) return null
  return DISTRICT_ROMAN_TO_NUMBER.get(value.toUpperCase()) ?? null
}

function categoryMatches(project: ProjectDoc, pro: ProDoc): boolean {
  return cleanString(project.categoryName).toLowerCase() === cleanString(pro.categoryName).toLowerCase()
}

function districtMatches(project: ProjectDoc, pro: ProDoc): boolean {
  const districts = Array.isArray(pro.districts) ? pro.districts : []
  if (districts.length === 0) return true
  const projectDistrict = districtNumber(project.customerDistrict)
  return projectDistrict === null || districts.includes(projectDistrict)
}

function publicProject(projectId: string, project: ProjectDoc) {
  return {
    id: projectId,
    categoryName: project.categoryName,
    answers: project.answers,
    customerDistrict: project.customerDistrict,
    attachmentUrls: project.attachmentUrls ?? [],
    createdAt: serializeValue(project.createdAt),
    updatedAt: serializeValue(project.updatedAt),
  }
}

function quoteSummary(doc: FirestoreDoc) {
  return serializeDoc(doc) as {
    id: string
    projectId: string
    proUid: string
    proName: string
    proCategoryName?: string
    categoryName: string
    quote: MarketplaceQuoteInput
    status: MarketplaceQuoteStatus
    requestId?: string
    createdAt?: string
    quotedAt?: string
    acceptedAt?: string
  }
}

export async function marketplaceAccess(proUid: string): Promise<{
  eligible: boolean
  hasProPlan: boolean
  reason?: string
  pro?: ProDoc
}> {
  const proSnap = await adminDb.collection('pros').doc(proUid).get()
  if (!proSnap.exists) return { eligible: false, hasProPlan: false, reason: 'Pro profile not found.' }

  const pro = proSnap.data() as ProDoc
  const hasProPlan = hasPaidProFeatures(pro.subscriptionStatus, pro.subscriptionCurrentPeriodEnd)
  if (pro.status !== 'active') return { eligible: false, hasProPlan, reason: 'Your pro profile must be active to use the marketplace.', pro }
  if (pro.profileVisibility === 'paused') return { eligible: false, hasProPlan, reason: 'Resume your pro profile visibility to use the marketplace.', pro }
  if (!hasProPlan) return { eligible: false, hasProPlan, reason: 'Upgrade to Mestermind Pro to quote marketplace projects.', pro }

  return { eligible: true, hasProPlan, pro }
}

export async function listMarketplaceProjects(proUid: string) {
  const access = await marketplaceAccess(proUid)
  if (!access.eligible || !access.pro) {
    return { access: { eligible: false, hasProPlan: access.hasProPlan, reason: access.reason }, projects: [] }
  }

  const [projectsSnap, quotesSnap] = await Promise.all([
    adminDb.collection('projects').where('status', '==', 'active').limit(100).get(),
    adminDb.collection('marketplaceQuotes').where('proUid', '==', proUid).get(),
  ])
  const quotedProjectIds = new Set(
    quotesSnap.docs
      .filter(doc => doc.data().status !== 'withdrawn')
      .map(doc => cleanString(doc.data().projectId)),
  )

  const projects = projectsSnap.docs
    .map(doc => ({ id: doc.id, data: doc.data() as ProjectDoc }))
    .filter(({ data }) => data.customerUid !== proUid)
    .filter(({ id, data }) => !data.invitedProUids?.includes(proUid) && !quotedProjectIds.has(id))
    .filter(({ data }) => categoryMatches(data, access.pro!) && districtMatches(data, access.pro!))
    .sort((a, b) => timestampMillis(b.data.updatedAt) - timestampMillis(a.data.updatedAt))
    .map(({ id, data }) => publicProject(id, data))

  return { access: { eligible: true, hasProPlan: true }, projects }
}

export async function submitMarketplaceQuote(
  proUid: string,
  projectId: string,
  input: MarketplaceQuoteInput,
) {
  const access = await marketplaceAccess(proUid)
  if (!access.eligible || !access.pro) {
    return { error: access.reason ?? 'Marketplace access required.', status: access.hasProPlan ? 403 : 402 }
  }

  const price = cleanString(input.price)
  const timeline = cleanString(input.timeline)
  const notes = cleanString(input.notes)
  if (!price || !timeline) return { error: 'Quote price and timeline are required.', status: 400 }

  const projectRef = adminDb.collection('projects').doc(projectId)
  const [projectSnap, existingQuoteSnap, existingRequestSnap] = await Promise.all([
    projectRef.get(),
    adminDb.collection('marketplaceQuotes')
      .where('projectId', '==', projectId)
      .where('proUid', '==', proUid)
      .limit(1)
      .get(),
    adminDb.collection('serviceRequests')
      .where('projectId', '==', projectId)
      .where('proUid', '==', proUid)
      .limit(1)
      .get(),
  ])

  if (!projectSnap.exists) return { error: 'Project not found.', status: 404 }
  const project = projectSnap.data() as ProjectDoc
  if (project.status !== 'active') return { error: 'This project is no longer active.', status: 409 }
  if (project.customerUid === proUid) return { error: 'You cannot quote your own project.', status: 403 }
  if (project.invitedProUids?.includes(proUid)) return { error: 'This customer already sent this project to you directly.', status: 409 }
  if (!existingRequestSnap.empty) return { error: 'This project already has a request with you.', status: 409 }
  if (!existingQuoteSnap.empty && existingQuoteSnap.docs.some(doc => doc.data().status !== 'withdrawn')) {
    return { error: 'You have already sent a marketplace quote for this project.', status: 409 }
  }
  if (!categoryMatches(project, access.pro) || !districtMatches(project, access.pro)) {
    return { error: 'This project does not match your marketplace coverage.', status: 403 }
  }

  const quoteRef = adminDb.collection('marketplaceQuotes').doc()
  const quote = { price, timeline, notes }
  await quoteRef.set({
    projectId,
    proUid,
    proName: cleanString(access.pro.fullName, 'Mestermind Pro'),
    proCategoryName: cleanString(access.pro.categoryName),
    customerUid: project.customerUid,
    categoryName: project.categoryName,
    quote,
    status: 'submitted',
    quotedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await createInAppNotification({
    recipientUid: project.customerUid,
    recipientRole: 'customer',
    actorUid: proUid,
    actorRole: 'pro',
    type: 'marketplace.quote_submitted',
    title: 'New marketplace quote',
    body: `${cleanString(access.pro.fullName, 'A pro')} sent a quote for your ${project.categoryName} project.`,
    href: '/projects',
    requestId: quoteRef.id,
    metadata: { projectId, proUid, categoryName: project.categoryName, source: 'marketplace' },
  })

  return { quoteId: quoteRef.id, quote }
}

export async function listMarketplaceQuotesForProjects(customerUid: string, projectIds: string[]) {
  if (projectIds.length === 0) return new Map<string, ReturnType<typeof quoteSummary>[]>()

  const quotesByProject = new Map<string, ReturnType<typeof quoteSummary>[]>()
  for (let i = 0; i < projectIds.length; i += 10) {
    const batchIds = projectIds.slice(i, i + 10)
    const snap = await adminDb.collection('marketplaceQuotes')
      .where('customerUid', '==', customerUid)
      .where('projectId', 'in', batchIds)
      .get()
    for (const doc of snap.docs) {
      const data = doc.data() as MarketplaceQuoteDoc
      if (data.status !== 'submitted' && data.status !== 'accepted') continue
      const quotes = quotesByProject.get(data.projectId) ?? []
      quotes.push(quoteSummary(doc))
      quotesByProject.set(data.projectId, quotes)
    }
  }

  for (const quotes of quotesByProject.values()) {
    quotes.sort((a, b) => new Date(b.quotedAt ?? b.createdAt ?? 0).getTime() - new Date(a.quotedAt ?? a.createdAt ?? 0).getTime())
  }
  return quotesByProject
}

export async function acceptMarketplaceQuote(
  customerUid: string,
  projectId: string,
  quoteId: string,
  input: MarketplaceAcceptInput,
) {
  const message = cleanString(input.message)
  if (!message) return { error: 'Please include a message for the pro.', status: 400 }

  const projectRef = adminDb.collection('projects').doc(projectId)
  const quoteRef = adminDb.collection('marketplaceQuotes').doc(quoteId)
  const [projectSnap, quoteSnap] = await Promise.all([projectRef.get(), quoteRef.get()])
  if (!projectSnap.exists || !quoteSnap.exists) return { error: 'Marketplace quote not found.', status: 404 }

  const project = projectSnap.data() as ProjectDoc
  const marketplaceQuote = quoteSnap.data() as MarketplaceQuoteDoc
  const existingRequestSnap = await adminDb.collection('serviceRequests')
    .where('projectId', '==', projectId)
    .where('proUid', '==', marketplaceQuote.proUid)
    .limit(1)
    .get()
  if (project.customerUid !== customerUid || marketplaceQuote.customerUid !== customerUid || marketplaceQuote.projectId !== projectId) {
    return { error: 'Not allowed.', status: 403 }
  }
  if (project.status !== 'active') return { error: 'This project is no longer active.', status: 409 }
  if (marketplaceQuote.status !== 'submitted') return { error: 'This marketplace quote can no longer be accepted.', status: 409 }
  if (!existingRequestSnap.empty) return { error: 'This project already has a request with this pro.', status: 409 }

  const proSnap = await adminDb.collection('pros').doc(marketplaceQuote.proUid).get()
  if (!proSnap.exists || proSnap.data()?.status !== 'active') {
    return { error: 'This pro is not currently available.', status: 409 }
  }

  const requestRef = adminDb.collection('serviceRequests').doc()
  const convRef = adminDb.collection('conversations').doc(requestRef.id)
  const msgRef = convRef.collection('messages').doc()
  const customerName = cleanString(project.customerName, 'Customer')
  const customerEmail = cleanString(project.customerEmail)
  const acceptance = {
    message,
    phone: cleanString(input.phone),
    address: cleanString(input.address),
    preferredStart: cleanString(input.preferredStart),
    acceptedAt: FieldValue.serverTimestamp(),
  }

  const batch = adminDb.batch()
  batch.set(requestRef, {
    projectId,
    source: 'marketplace',
    marketplaceQuoteId: quoteId,
    proUid: marketplaceQuote.proUid,
    proName: marketplaceQuote.proName,
    categoryName: project.categoryName,
    answers: project.answers,
    customerUid,
    customerName,
    customerEmail,
    customerDistrict: project.customerDistrict ?? '',
    ...(project.jobLocation ? { jobLocation: project.jobLocation } : {}),
    ...(project.attachmentUrls?.length ? { attachmentUrls: project.attachmentUrls } : {}),
    quote: {
      ...marketplaceQuote.quote,
      quotedAt: marketplaceQuote.quotedAt ?? FieldValue.serverTimestamp(),
    },
    status: 'accepted',
    acceptance,
    statusHistory: [
      { status: 'marketplace_quoted', actorUid: marketplaceQuote.proUid, actorRole: 'pro', at: new Date() },
      { status: 'accepted', actorUid: customerUid, actorRole: 'customer', at: new Date() },
    ],
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.set(convRef, {
    requestId: requestRef.id,
    proUid: marketplaceQuote.proUid,
    customerUid,
    proName: marketplaceQuote.proName,
    customerName,
    categoryName: project.categoryName,
    lastMessage: message,
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.set(msgRef, {
    senderUid: customerUid,
    senderRole: 'customer',
    text: message,
    createdAt: FieldValue.serverTimestamp(),
  })
  batch.update(quoteRef, {
    status: 'accepted',
    requestId: requestRef.id,
    acceptedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  batch.update(projectRef, {
    invitedProUids: FieldValue.arrayUnion(marketplaceQuote.proUid),
    updatedAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()

  await createInAppNotification({
    recipientUid: marketplaceQuote.proUid,
    recipientRole: 'pro',
    actorUid: customerUid,
    actorRole: 'customer',
    type: 'marketplace.quote_accepted',
    title: 'Marketplace quote accepted',
    body: `${customerName} accepted your quote for ${project.categoryName}.`,
    href: `/pro/jobs/${requestRef.id}`,
    requestId: requestRef.id,
    metadata: { projectId, marketplaceQuoteId: quoteId, source: 'marketplace' },
  })

  return { requestId: requestRef.id }
}

export async function declineMarketplaceQuote(
  customerUid: string,
  projectId: string,
  quoteId: string,
  reason?: string,
) {
  const quoteRef = adminDb.collection('marketplaceQuotes').doc(quoteId)
  const quoteSnap = await quoteRef.get()
  if (!quoteSnap.exists) return { error: 'Marketplace quote not found.', status: 404 }

  const marketplaceQuote = quoteSnap.data() as MarketplaceQuoteDoc
  if (marketplaceQuote.customerUid !== customerUid || marketplaceQuote.projectId !== projectId) {
    return { error: 'Not allowed.', status: 403 }
  }
  if (marketplaceQuote.status !== 'submitted') {
    return { error: 'This marketplace quote can no longer be declined.', status: 409 }
  }

  await quoteRef.update({
    status: 'declined',
    declineReason: cleanString(reason),
    declinedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await createInAppNotification({
    recipientUid: marketplaceQuote.proUid,
    recipientRole: 'pro',
    actorUid: customerUid,
    actorRole: 'customer',
    type: 'marketplace.quote_declined',
    title: 'Marketplace quote declined',
    body: `The customer declined your quote for ${marketplaceQuote.categoryName}.`,
    href: '/pro/marketplace',
    requestId: quoteId,
    metadata: { projectId, marketplaceQuoteId: quoteId, source: 'marketplace' },
  })

  return { ok: true }
}

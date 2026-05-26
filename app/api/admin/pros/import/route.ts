import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, adminStorage } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import servicesData from '@/public/services.json'

export const runtime = 'nodejs'

type QjobExecutor = {
  user_id?: string
  name?: string
  profile_url?: string
  photo_url?: string
  rating?: string
  review_count?: string
  address?: string
  categories?: string[]
  qjob_categories?: string[]
  mestermind_categories?: string[]
  mestermind_services?: string[]
  description?: string
  phone?: string | null
  masked_phone?: string | null
  phone_source?: string | null
  scrape_error?: string | null
}

type ImportPayload = {
  executors?: QjobExecutor[]
}

type ImportResult = {
  name: string
  email: string
  uid?: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

type ProgressEvent =
  | { type: 'start'; total: number }
  | { type: 'row_start'; index: number; total: number; name: string; email: string }
  | { type: 'step'; index: number; total: number; name: string; email: string; step: string; message: string }
  | { type: 'result'; index: number; total: number; result: ImportResult }
  | { type: 'done'; imported: number; updated: number; skipped: number; failed: number; results: ImportResult[] }
  | { type: 'error'; message: string }

type ProgressReporter = (step: string, message: string) => void

type ExistingImport = {
  uid: string
  email?: string
}

const MAX_IMPORT_ROWS = 500
const DEFAULT_IMAGE_DELAY_MS = 1200
const TRIAL_DAYS = 30

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.map(item => cleanString(item)).filter(Boolean))]
    : []
}

function importIdentity(executor: QjobExecutor): string | null {
  const userId = cleanString(executor.user_id)
  if (userId) return `qjob_user:${userId}`

  const profileUrl = cleanString(executor.profile_url)
  if (profileUrl) return `qjob_profile:${profileUrl}`

  const name = emailLocalPart(cleanString(executor.name))
  const address = cleanString(executor.address).toLowerCase()
  return name && address ? `name_address:${name}:${address}` : null
}

function mergeExecutors(existing: QjobExecutor, incoming: QjobExecutor): QjobExecutor {
  const merged: QjobExecutor = { ...existing }
  for (const [key, value] of Object.entries(incoming) as Array<[keyof QjobExecutor, QjobExecutor[keyof QjobExecutor]]>) {
    if (Array.isArray(value)) {
      const previous = Array.isArray(merged[key]) ? merged[key] : []
      merged[key] = [...new Set([...previous, ...value].map(item => cleanString(item)).filter(Boolean))] as never
    } else if (value !== null && value !== undefined && value !== '') {
      merged[key] = value as never
    }
  }
  return merged
}

function dedupeExecutors(executors: QjobExecutor[]): QjobExecutor[] {
  const rows: QjobExecutor[] = []
  const indexes = new Map<string, number>()

  for (const executor of executors) {
    const key = importIdentity(executor)
    if (!key) {
      rows.push(executor)
      continue
    }

    const index = indexes.get(key)
    if (index === undefined) {
      indexes.set(key, rows.length)
      rows.push(executor)
    } else {
      rows[index] = mergeExecutors(rows[index], executor)
    }
  }

  return rows
}

function emailLocalPart(name: string): string {
  const stripped = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 50)

  return stripped || `qjob-pro-${Date.now()}`
}

async function uniqueImportEmail(name: string, seen: Set<string>): Promise<string> {
  const base = emailLocalPart(name)
  let candidate = `${base}@mestermind.com`
  let suffix = 2

  while (seen.has(candidate)) {
    candidate = `${base}.${suffix}@mestermind.com`
    suffix += 1
  }

  seen.add(candidate)
  return candidate
}

async function accountEmail(uid: string): Promise<string | undefined> {
  const accountSnap = await adminDb.collection('pros').doc(uid).collection('private').doc('account').get()
  return accountSnap.exists ? cleanString(accountSnap.data()?.email) || undefined : undefined
}

async function findExistingImport(executor: QjobExecutor): Promise<ExistingImport | null> {
  const userId = cleanString(executor.user_id)
  if (userId) {
    const snap = await adminDb.collection('pros').where('qjob.userId', '==', userId).limit(1).get()
    if (!snap.empty) {
      const uid = snap.docs[0].id
      return { uid, email: await accountEmail(uid) }
    }
  }

  const profileUrl = cleanString(executor.profile_url)
  if (profileUrl) {
    const snap = await adminDb.collection('pros').where('qjob.profileUrl', '==', profileUrl).limit(1).get()
    if (!snap.empty) {
      const uid = snap.docs[0].id
      return { uid, email: await accountEmail(uid) }
    }
  }

  return null
}

function categoryId(categoryName: string): string {
  return categoryName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function knownCategory(name: string): boolean {
  return servicesData.categories.some(category => category.name === name)
}

function knownServices(categoryName: string, services: string[]): string[] {
  const category = servicesData.categories.find(item => item.name === categoryName)
  if (!category) return []
  const allowed = new Set(category.services)
  return services.filter(service => allowed.has(service))
}

function primaryCategory(executor: QjobExecutor): string {
  const categories = cleanStringArray(executor.mestermind_categories)
  return categories.find(knownCategory) ?? 'Handyman'
}

function mappedServices(executor: QjobExecutor, categoryName: string): string[] {
  const services = knownServices(categoryName, cleanStringArray(executor.mestermind_services))
  if (services.length > 0) return services
  const category = servicesData.categories.find(item => item.name === categoryName)
  return category?.featured.slice(0, 3) ?? ['General Repairs']
}

function parseRating(value: unknown): number | null {
  const rating = Number.parseFloat(cleanString(value).replace(',', '.'))
  return Number.isFinite(rating) ? rating : null
}

function parseReviewCount(value: unknown): number {
  const match = cleanString(value).match(/\d+/)
  return match ? Number(match[0]) : 0
}

function parsePostcode(address: string): string {
  return address.match(/\b\d{4}\b/)?.[0] ?? ''
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function downloadUrl(bucketName: string, objectPath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

function imageExtension(contentType: string, sourceUrl: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  return sourceUrl.match(/\.(png|jpe?g|webp|gif)(?:\?|$)/i)?.[1]?.replace('jpeg', 'jpg') ?? 'jpg'
}

async function downloadAvatar(
  uid: string,
  sourceUrl: string,
  delayMs: number,
): Promise<string | null> {
  if (!/^https?:\/\//i.test(sourceUrl)) return null
  if (delayMs > 0) await sleep(delayMs)

  const response = await fetch(sourceUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mestermind admin import (contact: admin@mestermind.com)',
    },
  })
  if (!response.ok) {
    throw new Error(`Avatar download failed with ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new Error(`Avatar URL returned ${contentType}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error('Avatar image is larger than 5 MB')
  }

  const token = randomUUID()
  const ext = imageExtension(contentType, sourceUrl)
  const objectPath = `pros/${uid}/imports/qjob-avatar.${ext}`
  const bucket = adminStorage.bucket()

  await bucket.file(objectPath).save(bytes, {
    resumable: false,
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
        ownerUid: uid,
        importedFrom: sourceUrl,
      },
    },
  })

  return downloadUrl(bucket.name, objectPath, token)
}

async function authUserForEmail(
  email: string,
  displayName: string,
  existingUid?: string,
): Promise<{ uid: string; created: boolean }> {
  if (existingUid) {
    try {
      const existing = await adminAuth.getUser(existingUid)
      await adminAuth.updateUser(existingUid, {
        displayName,
        ...(existing.email ? {} : { email, emailVerified: true }),
      })
      return { uid: existingUid, created: false }
    } catch (err) {
      if (!(err && typeof err === 'object' && 'code' in err) || err.code !== 'auth/user-not-found') {
        throw err
      }
    }
  }

  try {
    const existing = await adminAuth.getUserByEmail(email)
    await adminAuth.updateUser(existing.uid, { displayName })
    return { uid: existing.uid, created: false }
  } catch (err) {
    if (!(err && typeof err === 'object' && 'code' in err) || err.code !== 'auth/user-not-found') {
      throw err
    }
  }

  const created = await adminAuth.createUser({
    email,
    emailVerified: true,
    displayName,
    password: randomUUID(),
  })

  return { uid: created.uid, created: true }
}

async function importExecutor(
  executor: QjobExecutor,
  email: string,
  requestedStatus: string,
  imageDelayMs: number,
  existingUid?: string,
  reportProgress?: ProgressReporter,
): Promise<ImportResult> {
  const fullName = cleanString(executor.name)
  if (!fullName) {
    return { name: '', email, status: 'skipped', message: 'Missing business name.' }
  }

  reportProgress?.('auth', 'Creating or updating Firebase Auth user.')
  const { uid, created } = await authUserForEmail(email, fullName, existingUid)
  reportProgress?.('mapping', 'Mapping Qjob data to Mestermind pro fields.')
  const categoryName = primaryCategory(executor)
  const services = mappedServices(executor, categoryName)
  const phone = cleanString(executor.phone) || cleanString(executor.masked_phone)
  const bio = cleanString(executor.description)
  const rating = parseRating(executor.rating)
  const reviewCount = parseReviewCount(executor.review_count)
  const postcode = parsePostcode(cleanString(executor.address))
  const trialEndsAt = Timestamp.fromDate(new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000))
  let message = ''

  let avatarUrl: string | null = null
  const photoUrl = cleanString(executor.photo_url)
  if (photoUrl) {
    try {
      reportProgress?.('image', `Waiting ${imageDelayMs}ms before downloading avatar.`)
      avatarUrl = await downloadAvatar(uid, photoUrl, imageDelayMs)
      reportProgress?.('image', 'Avatar downloaded and saved to Firebase Storage.')
    } catch (err) {
      message = err instanceof Error ? `Avatar skipped: ${err.message}` : 'Avatar skipped.'
      reportProgress?.('image', message)
    }
  }

  const proRef = adminDb.collection('pros').doc(uid)
  const batch = adminDb.batch()
  const status = ['pending_verification', 'active', 'suspended', 'rejected'].includes(requestedStatus)
    ? requestedStatus
    : 'active'

  batch.set(adminDb.collection('users').doc(uid), {
    uid,
    email,
    emailVerified: true,
    displayName: fullName,
    firstName: fullName,
    lastName: '',
    phone,
    phoneVerified: Boolean(cleanString(executor.phone)),
    address: cleanString(executor.address),
    avatarUrl,
    importedFrom: 'qjob',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  batch.set(proRef, {
    uid,
    fullName,
    phoneVerified: Boolean(cleanString(executor.phone)),
    categoryId: categoryId(categoryName),
    categoryName,
    regulated: false,
    services,
    districts: [],
    radius: 30,
    postcode,
    bio,
    yearsExp: '',
    pricingType: 'quote',
    hourlyRate: '',
    availability: [],
    socialLinks: {
      website: cleanString(executor.profile_url),
    },
    paymentMethods: [],
    faqs: {},
    backgroundCheck: false,
    avatarUrl,
    workPhotoUrls: [],
    pastProjects: [],
    profileVisibility: 'visible',
    subscriptionStatus: 'trialing',
    subscriptionActive: true,
    subscriptionCurrentPeriodEnd: trialEndsAt,
    status,
    verificationStatus: status,
    rating,
    reviewCount,
    importSource: 'qjob',
    qjob: {
      userId: cleanString(executor.user_id),
      profileUrl: cleanString(executor.profile_url),
      photoUrl,
      address: cleanString(executor.address),
      categories: cleanStringArray(executor.qjob_categories ?? executor.categories),
      mestermindCategories: cleanStringArray(executor.mestermind_categories),
      mestermindServices: cleanStringArray(executor.mestermind_services),
      phoneSource: cleanString(executor.phone_source),
      scrapeError: cleanString(executor.scrape_error),
    },
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  batch.set(proRef.collection('private').doc('account'), {
    email,
    phone,
    phoneVerified: Boolean(cleanString(executor.phone)),
    notificationPreferences: {
      newLeads: true,
      messages: true,
      appointments: true,
      email: false,
      sms: false,
    },
    subscriptionStatus: 'trialing',
    subscriptionCurrentPeriodEnd: trialEndsAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  batch.set(proRef.collection('private').doc('verification'), {
    backgroundCheck: false,
    regulated: false,
    status,
    source: 'qjob_import',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  batch.set(proRef.collection('private').doc('payout'), {
    payout: { iban: '' },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  reportProgress?.('firestore', 'Writing user, pro, account, verification, and payout documents.')
  await batch.commit()

  if (avatarUrl) {
    reportProgress?.('auth', 'Updating Firebase Auth photo URL.')
    await adminAuth.updateUser(uid, { photoURL: avatarUrl })
  }

  return {
    name: fullName,
    email,
    uid,
    status: created ? 'created' : 'updated',
    message,
  }
}

function streamImport(
  executors: QjobExecutor[],
  status: string,
  imageDelayMs: number,
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      void (async () => {
        const seenEmails = new Set<string>()
        const results: ImportResult[] = []
        const total = executors.length

        try {
          send({ type: 'start', total })

          for (const [index, executor] of executors.entries()) {
            const rowNumber = index + 1
            const name = cleanString(executor.name)
            const existingImport = await findExistingImport(executor)
            const email = existingImport?.email ?? await uniqueImportEmail(name, seenEmails)
            seenEmails.add(email)
            send({ type: 'row_start', index: rowNumber, total, name, email })

            try {
              const result = await importExecutor(
                executor,
                email,
                status,
                imageDelayMs,
                existingImport?.uid,
                (step, message) => {
                  send({ type: 'step', index: rowNumber, total, name, email, step, message })
                },
              )
              results.push(result)
              send({ type: 'result', index: rowNumber, total, result })
            } catch (err) {
              const result: ImportResult = {
                name,
                email,
                status: 'error',
                message: err instanceof Error ? err.message : 'Import failed.',
              }
              results.push(result)
              send({ type: 'result', index: rowNumber, total, result })
            }
          }

          send({
            type: 'done',
            imported: results.filter(item => item.status === 'created').length,
            updated: results.filter(item => item.status === 'updated').length,
            skipped: results.filter(item => item.status === 'skipped').length,
            failed: results.filter(item => item.status === 'error').length,
            results,
          })
        } catch (err) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Import failed.' })
        } finally {
          controller.close()
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const form = await request.formData()
    const file = form.get('file')
    const status = cleanString(form.get('status'), 'active')
    const imageDelayMs = Math.max(Number(form.get('imageDelayMs') ?? DEFAULT_IMAGE_DELAY_MS) || DEFAULT_IMAGE_DELAY_MS, 0)

    if (!(file instanceof File)) {
      return Response.json({ error: 'JSON file is required.' }, { status: 400 })
    }
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'JSON file must be under 20 MB.' }, { status: 400 })
    }

    const payload = JSON.parse(await file.text()) as ImportPayload
    const executors = Array.isArray(payload.executors)
      ? dedupeExecutors(payload.executors).slice(0, MAX_IMPORT_ROWS)
      : []
    if (executors.length === 0) {
      return Response.json({ error: 'No executors found in JSON.' }, { status: 400 })
    }

    return streamImport(executors, status, imageDelayMs)
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    if (err instanceof SyntaxError) {
      return Response.json({ error: 'Uploaded file is not valid JSON.' }, { status: 400 })
    }
    console.error('[/api/admin/pros/import POST]', err)
    return Response.json({ error: 'Could not import pros.' }, { status: 500 })
  }
}

import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { adminStorage } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { enforceUserRateLimit } from '@/lib/rateLimit'

const MAX_IMAGE_UPLOAD_SIZE = 3 * 1024 * 1024
const MAX_DOCUMENT_UPLOAD_SIZE = 5 * 1024 * 1024
const MAX_MULTIPART_BODY_SIZE = MAX_DOCUMENT_UPLOAD_SIZE + 1024 * 1024
const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
])

function cleanPathPart(value: string): string {
  return value
    .split('/')
    .map(part => part.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .filter(Boolean)
    .join('/')
}

function cleanFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_') || 'upload'
}

function downloadUrl(bucketName: string, objectPath: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
}

function isImageContentType(contentType: string): boolean {
  return contentType.startsWith('image/')
}

function uploadLimit(scope: FormDataEntryValue | null, path: string, contentType: string): number {
  if (scope === 'request-attachment') {
    return isImageContentType(contentType) ? MAX_IMAGE_UPLOAD_SIZE : MAX_DOCUMENT_UPLOAD_SIZE
  }

  if (path === 'avatar' || path === 'selfie' || path.startsWith('projects/')) {
    return MAX_IMAGE_UPLOAD_SIZE
  }

  return isImageContentType(contentType) ? MAX_IMAGE_UPLOAD_SIZE : MAX_DOCUMENT_UPLOAD_SIZE
}

function canUploadContentType(scope: FormDataEntryValue | null, path: string, contentType: string): boolean {
  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) return false
  if (scope !== 'pro') return true
  if (path === 'avatar' || path === 'selfie' || path.startsWith('projects/')) {
    return isImageContentType(contentType)
  }
  return true
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value)
}

function detectContentType(bytes: Uint8Array): string {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (
    startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61])
    || startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return 'image/gif'
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('expensive', user.uid)
    if (limited) return limited

    const contentLength = Number(request.headers.get('content-length') ?? 0)
    if (contentLength > MAX_MULTIPART_BODY_SIZE) {
      return Response.json({ error: 'File must be under 5 MB.' }, { status: 413 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const scope = form.get('scope')

    if (!(file instanceof File)) {
      return Response.json({ error: 'File is required.' }, { status: 400 })
    }
    if (file.type && !ALLOWED_UPLOAD_TYPES.has(file.type)) {
      return Response.json({ error: 'Upload photos or PDF files only.' }, { status: 400 })
    }

    let objectPath = ''
    let requestedPath = ''

    if (scope === 'pro') {
      requestedPath = cleanPathPart(String(form.get('path') ?? ''))
      if (!requestedPath) {
        return Response.json({ error: 'Upload path is required.' }, { status: 400 })
      }
      objectPath = `pros/${user.uid}/${requestedPath}`
    } else if (scope === 'request-attachment') {
      objectPath = `users/${user.uid}/request-attachments/${Date.now()}-${cleanFilename(file.name)}`
    } else {
      return Response.json({ error: 'Unknown upload scope.' }, { status: 400 })
    }

    const bucket = adminStorage.bucket()
    const token = randomUUID()
    const bytes = Buffer.from(await file.arrayBuffer())
    const contentType = detectContentType(bytes)
    if (!contentType || (file.type && file.type !== contentType) || !canUploadContentType(scope, requestedPath, contentType)) {
      return Response.json({ error: 'Upload photos or PDF files only.' }, { status: 400 })
    }

    const maxSize = uploadLimit(scope, requestedPath, contentType)
    if (file.size > maxSize) {
      const maxMb = Math.floor(maxSize / 1024 / 1024)
      return Response.json({ error: `File must be under ${maxMb} MB.` }, { status: 400 })
    }

    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
          ownerUid: user.uid,
        },
      },
    })

    return Response.json({ url: downloadUrl(bucket.name, objectPath, token), path: objectPath })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/uploads POST]', err)
    return Response.json({ error: 'Could not upload file.' }, { status: 500 })
  }
}

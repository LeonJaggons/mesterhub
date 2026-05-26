import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { adminStorage } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024

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

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const form = await request.formData()
    const file = form.get('file')
    const scope = form.get('scope')

    if (!(file instanceof File)) {
      return Response.json({ error: 'File is required.' }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      return Response.json({ error: 'File must be under 10 MB.' }, { status: 400 })
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return Response.json({ error: 'Upload photos or PDF files only.' }, { status: 400 })
    }

    const bucket = adminStorage.bucket()
    const token = randomUUID()
    const bytes = Buffer.from(await file.arrayBuffer())
    let objectPath = ''

    if (scope === 'pro') {
      const requestedPath = cleanPathPart(String(form.get('path') ?? ''))
      if (!requestedPath) {
        return Response.json({ error: 'Upload path is required.' }, { status: 400 })
      }
      objectPath = `pros/${user.uid}/${requestedPath}`
    } else if (scope === 'request-attachment') {
      objectPath = `users/${user.uid}/request-attachments/${Date.now()}-${cleanFilename(file.name)}`
    } else {
      return Response.json({ error: 'Unknown upload scope.' }, { status: 400 })
    }

    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      metadata: {
        contentType: file.type || 'application/octet-stream',
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

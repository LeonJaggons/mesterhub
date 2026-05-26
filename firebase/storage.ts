import { authenticatedFetch } from './apiClient'

/**
 * Upload a file to Firebase Storage under pros/{uid}/{path}
 * and return the public download URL.
 */
export async function uploadProFile(
  _uid: string,
  path: string,
  file: File,
): Promise<string> {
  const form = new FormData()
  form.set('scope', 'pro')
  form.set('path', path)
  form.set('file', file)
  const response = await authenticatedFetch('/api/uploads', {
    method: 'POST',
    body: form,
  })
  const data = (await response.json()) as { url: string }
  return data.url
}

export async function uploadServiceRequestAttachment(
  _uid: string,
  file: File,
): Promise<string> {
  const form = new FormData()
  form.set('scope', 'request-attachment')
  form.set('file', file)
  const response = await authenticatedFetch('/api/uploads', {
    method: 'POST',
    body: form,
  })
  const data = (await response.json()) as { url: string }
  return data.url
}

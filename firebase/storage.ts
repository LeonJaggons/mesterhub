import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './index'

/**
 * Upload a file to Firebase Storage under pros/{uid}/{path}
 * and return the public download URL.
 */
export async function uploadProFile(
  uid: string,
  path: string,
  file: File,
): Promise<string> {
  const storageRef = ref(storage, `pros/${uid}/${path}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

export async function uploadServiceRequestAttachment(
  uid: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storageRef = ref(storage, `users/${uid}/request-attachments/${Date.now()}-${safeName}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

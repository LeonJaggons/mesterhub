import { adminAuth, adminDb, adminStorage } from '@/firebase/admin'

const MAX_BATCH_WRITES = 450

export class FirestoreWriteQueue {
  private batch = adminDb.batch()
  private writes = 0

  deleted = 0
  updated = 0

  async delete(ref: FirebaseFirestore.DocumentReference) {
    this.batch.delete(ref)
    this.writes += 1
    this.deleted += 1
    await this.flushIfNeeded()
  }

  async update(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
    this.batch.update(ref, data)
    this.writes += 1
    this.updated += 1
    await this.flushIfNeeded()
  }

  async commit() {
    if (this.writes === 0) return
    await this.batch.commit()
    this.batch = adminDb.batch()
    this.writes = 0
  }

  private async flushIfNeeded() {
    if (this.writes >= MAX_BATCH_WRITES) {
      await this.commit()
    }
  }
}

export async function deleteDocumentTree(
  ref: FirebaseFirestore.DocumentReference,
  queue: FirestoreWriteQueue,
  seen: Set<string>,
) {
  if (seen.has(ref.path)) return
  seen.add(ref.path)

  const collections = await ref.listCollections()
  for (const collection of collections) {
    const snap = await collection.get()
    for (const doc of snap.docs) {
      await deleteDocumentTree(doc.ref, queue, seen)
    }
  }

  await queue.delete(ref)
}

export async function deleteQueryResults(
  query: FirebaseFirestore.Query,
  queue: FirestoreWriteQueue,
  seen: Set<string>,
) {
  const snap = await query.get()
  for (const doc of snap.docs) {
    await deleteDocumentTree(doc.ref, queue, seen)
  }
  return snap.size
}

export async function deleteStoragePrefix(prefix: string) {
  await adminStorage.bucket().deleteFiles({
    prefix,
    force: true,
  })
}

export async function deleteAuthUser(uid: string) {
  try {
    await adminAuth.deleteUser(uid)
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') {
      throw err
    }
  }
}

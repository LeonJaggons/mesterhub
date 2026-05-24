import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './index'

export type ProProfileSummary = {
  uid: string
  fullName: string
  categoryName: string
}

function toSummary(docId: string, data: Record<string, unknown>): ProProfileSummary {
  return {
    uid: (data.uid as string) ?? docId,
    fullName: (data.fullName as string) ?? '',
    categoryName: (data.categoryName as string) ?? '',
  }
}

/** Load pro profile for the signed-in user from Firestore (client SDK). */
export async function resolveProClient(user: User): Promise<ProProfileSummary | null> {
  try {
    const byId = await getDoc(doc(db, 'pros', user.uid))
    if (byId.exists()) return toSummary(byId.id, byId.data())
  } catch {
    // rules or network — try fallbacks
  }

  try {
    const byUid = await getDocs(
      query(collection(db, 'pros'), where('uid', '==', user.uid), limit(1))
    )
    if (!byUid.empty) {
      const d = byUid.docs[0]
      return toSummary(d.id, d.data())
    }
  } catch {
    // index may be missing
  }

  if (user.email) {
    try {
      const byEmail = await getDocs(
        query(collection(db, 'pros'), where('email', '==', user.email), limit(1))
      )
      if (!byEmail.empty) {
        const d = byEmail.docs[0]
        return toSummary(d.id, d.data())
      }
    } catch {
      // index may be missing
    }
  }

  return null
}

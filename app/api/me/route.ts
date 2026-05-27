import { NextRequest } from 'next/server'
import { adminAuth, adminDb } from '@/firebase/admin'
import { isLocale, type Locale } from '@/lib/i18n/config'
import { enforceUserRateLimit } from '@/lib/rateLimit'

export type ProProfileSummary = {
  uid: string
  fullName: string
  categoryName: string
}

async function preferredLocaleForUser(uid: string): Promise<Locale | null> {
  const snap = await adminDb.collection('users').doc(uid).get()
  if (!snap.exists) return null
  const preferredLocale = snap.data()?.preferredLocale
  return typeof preferredLocale === 'string' && isLocale(preferredLocale) ? preferredLocale : null
}

/** Resolve a pro document for the signed-in user (doc id, uid field, or email). */
async function resolvePro(uid: string, email?: string): Promise<ProProfileSummary | null> {
  const col = adminDb.collection('pros')

  const byId = await col.doc(uid).get()
  if (byId.exists) {
    const data = byId.data()!
    return {
      uid: (data.uid as string) ?? byId.id,
      fullName: (data.fullName as string) ?? '',
      categoryName: (data.categoryName as string) ?? '',
    }
  }

  const byUid = await col.where('uid', '==', uid).limit(1).get()
  if (!byUid.empty) {
    const doc = byUid.docs[0]
    const data = doc.data()
    return {
      uid: (data.uid as string) ?? doc.id,
      fullName: (data.fullName as string) ?? '',
      categoryName: (data.categoryName as string) ?? '',
    }
  }

  if (email) {
    const byEmail = await col.where('email', '==', email).limit(1).get()
    if (!byEmail.empty) {
      const doc = byEmail.docs[0]
      const data = doc.data()
      return {
        uid: (data.uid as string) ?? doc.id,
        fullName: (data.fullName as string) ?? '',
        categoryName: (data.categoryName as string) ?? '',
      }
    }
  }

  return null
}

export async function GET(request: NextRequest) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return Response.json({ pro: null }, { status: 401 })
  }

  try {
    const decoded = await adminAuth.verifyIdToken(header.slice(7))
    const limited = await enforceUserRateLimit('authRead', decoded.uid)
    if (limited) return limited

    try {
      const [pro, preferredLocale] = await Promise.all([
        resolvePro(decoded.uid, decoded.email),
        preferredLocaleForUser(decoded.uid),
      ])
      return Response.json({ pro, preferredLocale })
    } catch (dbErr) {
      console.error('[/api/me] firestore', dbErr)
      return Response.json({ pro: null })
    }
  } catch (err) {
    console.error('[/api/me] auth', err)
    return Response.json({ pro: null }, { status: 401 })
  }
}

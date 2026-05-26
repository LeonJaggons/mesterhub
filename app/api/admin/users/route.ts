import { NextRequest } from 'next/server'
import type { UserRecord } from 'firebase-admin/auth'
import { adminAuth, adminDb } from '@/firebase/admin'
import { requireAdmin } from '@/firebase/adminAccess'
import { serializeValue } from '../utils'

type AdminUser = {
  uid: string
  email: string
  displayName: string
  phoneNumber: string
  disabled: boolean
  createdAt: string
  lastSignInAt: string
  profile: Record<string, unknown>
}

function cleanQuery(value: string | null): string {
  return value?.trim().toLowerCase() ?? ''
}

function userFromRecord(record: UserRecord, profile: Record<string, unknown> = {}): AdminUser {
  return {
    uid: record.uid,
    email: record.email ?? String(profile.email ?? ''),
    displayName: record.displayName ?? String(profile.displayName ?? ''),
    phoneNumber: record.phoneNumber ?? String(profile.phone ?? ''),
    disabled: record.disabled,
    createdAt: record.metadata.creationTime,
    lastSignInAt: record.metadata.lastSignInTime,
    profile,
  }
}

function matchesQuery(user: AdminUser, q: string): boolean {
  if (!q) return true
  const haystack = [
    user.uid,
    user.email,
    user.displayName,
    user.phoneNumber,
    user.profile.firstName,
    user.profile.lastName,
    user.profile.preferredDistrict,
  ].join(' ').toLowerCase()
  return haystack.includes(q)
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const q = cleanQuery(request.nextUrl.searchParams.get('q'))
    const [authUsers, userProfilesSnap, prosSnap] = await Promise.all([
      adminAuth.listUsers(1000),
      adminDb.collection('users').limit(1000).get(),
      adminDb.collection('pros').limit(1000).get(),
    ])
    const proUids = new Set(prosSnap.docs.map(doc => doc.id))
    const profiles = new Map(
      userProfilesSnap.docs.map(doc => [
        doc.id,
        serializeValue(doc.data()) as Record<string, unknown>,
      ]),
    )
    const usersByUid = new Map<string, AdminUser>()

    for (const record of authUsers.users) {
      if (proUids.has(record.uid)) continue
      usersByUid.set(record.uid, userFromRecord(record, profiles.get(record.uid)))
    }

    for (const [uid, profile] of profiles) {
      if (proUids.has(uid) || usersByUid.has(uid)) continue
      usersByUid.set(uid, {
        uid,
        email: String(profile.email ?? ''),
        displayName: String(profile.displayName ?? ''),
        phoneNumber: String(profile.phone ?? ''),
        disabled: false,
        createdAt: String(profile.createdAt ?? ''),
        lastSignInAt: '',
        profile,
      })
    }

    const users = [...usersByUid.values()]
      .filter(user => matchesQuery(user, q))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 100)

    return Response.json({ users })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 })
    }
    console.error('[/api/admin/users GET]', err)
    return Response.json({ error: 'Could not load users.' }, { status: 500 })
  }
}

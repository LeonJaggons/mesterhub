import { NextRequest } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import type { SignupData } from '@/app/pro/signup/store'

type ProStatus = 'pending_verification' | 'active' | 'suspended' | 'rejected'

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(item => cleanString(item)).filter(Boolean)
    : []
}

function cleanNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter(Number.isFinite)
    : []
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const data = (await request.json()) as SignupData
    const status: ProStatus = 'pending_verification'
    const trialEndsAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    const fullName = cleanString(data.fullName, user.name ?? '')
    const email = cleanString(data.email, user.email ?? '')

    if (!fullName || !email || !cleanString(data.categoryName)) {
      return Response.json({ error: 'Name, email, and category are required.' }, { status: 400 })
    }

    await adminAuth.updateUser(user.uid, {
      displayName: fullName,
      ...(data.avatarUrl ? { photoURL: data.avatarUrl } : {}),
    })

    const batch = adminDb.batch()
    const proRef = adminDb.collection('pros').doc(user.uid)

    batch.set(proRef, {
      uid: user.uid,
      fullName,
      phoneVerified: data.phoneVerified ?? false,
      categoryId: cleanString(data.categoryId),
      categoryName: cleanString(data.categoryName),
      regulated: data.regulated ?? false,
      services: cleanStringArray(data.services),
      districts: cleanNumberArray(data.districts),
      radius: data.radius ?? 10,
      postcode: cleanString(data.postcode),
      bio: cleanString(data.bio),
      yearsExp: cleanString(data.yearsExp),
      pricingType: data.pricingType ?? 'quote',
      hourlyRate: cleanString(data.hourlyRate),
      availability: cleanStringArray(data.availability),
      socialLinks: data.socialLinks ?? {},
      paymentMethods: cleanStringArray(data.paymentMethods),
      faqs: data.faqs ?? {},
      backgroundCheck: data.backgroundCheck ?? false,
      avatarUrl: data.avatarUrl ?? null,
      workPhotoUrls: cleanStringArray(data.workPhotoUrls),
      pastProjects: data.pastProjects ?? [],
      profileVisibility: 'visible',
      subscriptionStatus: 'trialing',
      subscriptionActive: true,
      subscriptionCurrentPeriodEnd: trialEndsAt,
      status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    batch.set(proRef.collection('private').doc('account'), {
      email,
      phone: cleanString(data.phone),
      phoneVerified: data.phoneVerified ?? false,
      notificationPreferences: {
        newLeads: true,
        messages: true,
        appointments: true,
        email: true,
        sms: false,
      },
      subscriptionStatus: 'trialing',
      subscriptionCurrentPeriodEnd: trialEndsAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    batch.set(proRef.collection('private').doc('verification'), {
      idDocumentUrl: data.idDocumentUrl ?? null,
      selfieUrl: data.selfieUrl ?? null,
      licenceNumber: cleanString(data.licenceNumber),
      certificateUrl: data.certificateUrl ?? null,
      insuranceUrl: data.insuranceUrl ?? null,
      backgroundCheck: data.backgroundCheck ?? false,
      regulated: data.regulated ?? false,
      status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    batch.set(proRef.collection('private').doc('payout'), {
      payout: { iban: cleanString(data.iban) },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/signup POST]', err)
    return Response.json({ error: 'Could not save profile.' }, { status: 500 })
  }
}

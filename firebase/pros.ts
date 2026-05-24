import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from './index'
import type { SignupData } from '@/app/pro/signup/store'

export type ProStatus = 'pending_verification' | 'active' | 'suspended' | 'rejected'

export async function createProProfile(uid: string, data: SignupData): Promise<void> {
  const status: ProStatus = 'pending_verification'
  const trialEndsAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))

  await setDoc(doc(db, 'pros', uid), {
    uid,
    fullName: data.fullName ?? '',
    phoneVerified: data.phoneVerified ?? false,
    categoryId: data.categoryId ?? '',
    categoryName: data.categoryName ?? '',
    regulated: data.regulated ?? false,
    services: data.services ?? [],
    districts: data.districts ?? [],
    radius: data.radius ?? 10,
    postcode: data.postcode ?? '',
    bio: data.bio ?? '',
    yearsExp: data.yearsExp ?? '',
    pricingType: data.pricingType ?? 'quote',
    hourlyRate: data.hourlyRate ?? '',
    availability: data.availability ?? [],
    socialLinks: data.socialLinks ?? {},
    paymentMethods: data.paymentMethods ?? [],
    faqs: data.faqs ?? {},
    backgroundCheck: data.backgroundCheck ?? false,
    avatarUrl: data.avatarUrl ?? null,
    workPhotoUrls: data.workPhotoUrls ?? [],
    pastProjects: data.pastProjects ?? [],
    profileVisibility: 'visible',
    subscriptionStatus: 'trialing',
    subscriptionActive: true,
    subscriptionCurrentPeriodEnd: trialEndsAt,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await setDoc(doc(db, 'pros', uid, 'private', 'account'), {
    email: data.email ?? '',
    phone: data.phone ?? '',
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await setDoc(doc(db, 'pros', uid, 'private', 'verification'), {
    idDocumentUrl: data.idDocumentUrl ?? null,
    selfieUrl: data.selfieUrl ?? null,
    certificateUrl: data.certificateUrl ?? null,
    insuranceUrl: data.insuranceUrl ?? null,
    backgroundCheck: data.backgroundCheck ?? false,
    regulated: data.regulated ?? false,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await setDoc(doc(db, 'pros', uid, 'private', 'payout'), {
    payout: { iban: data.iban ?? '' },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

import { NextRequest } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { sendAdminNotification } from '@/firebase/adminNotifications'
import type { SignupData } from '@/app/pro/signup/store'
import { phoneVerificationEnabled } from '@/lib/featureFlags'
import { enforceUserRateLimit } from '@/lib/rateLimit'
import { claimProReferral } from '@/lib/referrals'

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
    const limited = await enforceUserRateLimit('expensive', user.uid)
    if (limited) return limited

    const data = (await request.json()) as SignupData
    const status: ProStatus = 'pending_verification'
    const trialEndsAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
    const fullName = cleanString(data.fullName, user.name ?? '')
    const email = cleanString(data.email, user.email ?? '')
    const verifiedPhone = typeof user.phone_number === 'string' ? user.phone_number : ''
    const requirePhoneVerification = await phoneVerificationEnabled()
    const phone = verifiedPhone || cleanString(data.phone)

    if (!fullName || !email || !cleanString(data.categoryName)) {
      return Response.json({ error: 'Name, email, and category are required.' }, { status: 400 })
    }
    if (requirePhoneVerification && !verifiedPhone) {
      return Response.json({ error: 'Verify your phone number before submitting your pro profile.' }, { status: 400 })
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
      phoneVerified: Boolean(verifiedPhone),
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
      phone,
      phoneVerified: Boolean(verifiedPhone),
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
    await claimProReferral({
      referredProUid: user.uid,
      rawCode: data.referralCode,
      proName: fullName,
      proEmail: email,
    })

    await sendAdminNotification({
      event: 'admin.pro.signup_submitted',
      subject: `New pro signup: ${fullName}`,
      previewText: `${fullName} submitted a ${cleanString(data.categoryName)} pro profile for verification.`,
      text: [
        'A new pro profile was submitted and is pending verification.',
        `Name: ${fullName}`,
        `Email: ${email}`,
        `Phone: ${phone || 'Not provided'}`,
        `Category: ${cleanString(data.categoryName)}`,
        `Services: ${cleanStringArray(data.services).join(', ') || 'None listed'}`,
        `Districts: ${cleanNumberArray(data.districts).join(', ') || 'None listed'}`,
        data.backgroundCheck ? 'Background check requested: yes' : 'Background check requested: no',
        data.licenceNumber ? `Licence number: ${cleanString(data.licenceNumber)}` : '',
        data.certificateUrl ? 'Certificate uploaded: yes' : '',
        data.insuranceUrl ? 'Insurance uploaded: yes' : '',
      ].filter(Boolean).join('\n\n'),
      actionPath: '/admin/pros',
      metadata: {
        proUid: user.uid,
        categoryName: cleanString(data.categoryName),
        status,
        phoneVerified: Boolean(verifiedPhone),
      },
    })

    return Response.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    console.error('[/api/pro/signup POST]', err)
    return Response.json({ error: 'Could not save profile.' }, { status: 500 })
  }
}

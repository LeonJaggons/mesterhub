import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { hasPaidProFeatures } from '@/lib/billing'

type ProDoc = {
  uid?: string
  fullName?: string
  categoryName?: string
  bio?: string
  yearsExp?: string
  pricingType?: 'hourly' | 'fixed' | 'quote' | string
  hourlyRate?: string
  availability?: string[]
  socialLinks?: {
    website?: string
    facebook?: string
    instagram?: string
    linkedin?: string
    tiktok?: string
  }
  paymentMethods?: string[]
  faqs?: {
    pricing?: string
    process?: string
    advice?: string
  }
  services?: string[]
  districts?: number[]
  radius?: string | number
  postcode?: string
  avatarUrl?: string | null
  workPhotoUrls?: string[]
  pastProjects?: unknown[]
  backgroundCheck?: boolean
  regulated?: boolean
  phoneVerified?: boolean
  certificateUrl?: string | null
  insuranceUrl?: string | null
  profileVisibility?: 'visible' | 'paused'
  status?: string
  subscriptionStatus?: string
  subscriptionCurrentPeriodEnd?: Date | { toDate?: () => Date; toMillis?: () => number } | null
  rating?: number
  reviewCount?: number
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params
    const snap = await adminDb.collection('pros').doc(uid).get()

    if (!snap.exists) {
      return Response.json({ pro: null }, { status: 404 })
    }

    const pro = snap.data() as ProDoc
    if (pro.status !== 'active' || pro.profileVisibility === 'paused') {
      return Response.json({ pro: null }, { status: 404 })
    }

    const subscriptionActive = hasPaidProFeatures(pro.subscriptionStatus, pro.subscriptionCurrentPeriodEnd)
    return Response.json({
      pro: {
        uid: pro.uid ?? snap.id,
        fullName: pro.fullName ?? '',
        categoryName: pro.categoryName ?? '',
        bio: pro.bio ?? '',
        yearsExp: pro.yearsExp ?? '',
        pricingType: pro.pricingType ?? 'quote',
        hourlyRate: pro.hourlyRate ?? '',
        availability: pro.availability ?? [],
        socialLinks: pro.socialLinks ?? {},
        paymentMethods: pro.paymentMethods ?? [],
        faqs: pro.faqs ?? {},
        services: pro.services ?? [],
        districts: pro.districts ?? [],
        radius: pro.radius ?? 10,
        postcode: pro.postcode ?? '',
        avatarUrl: pro.avatarUrl ?? null,
        workPhotoUrls: pro.workPhotoUrls ?? [],
        pastProjects: pro.pastProjects ?? [],
        backgroundCheck: Boolean(pro.backgroundCheck),
        regulated: Boolean(pro.regulated),
        phoneVerified: Boolean(pro.phoneVerified),
        certificateUrl: pro.certificateUrl ?? null,
        insuranceUrl: pro.insuranceUrl ?? null,
        status: pro.status ?? 'active',
        subscriptionActive,
        subscriptionStatus: pro.subscriptionStatus ?? 'inactive',
        subscriptionCurrentPeriodEnd: pro.subscriptionCurrentPeriodEnd ?? null,
        rating: subscriptionActive && typeof pro.rating === 'number' ? pro.rating : undefined,
        reviewCount: subscriptionActive && typeof pro.reviewCount === 'number' ? pro.reviewCount : undefined,
      },
    })
  } catch (err) {
    console.error('[/api/pros/[uid]]', err)
    return Response.json({ pro: null, error: 'Could not load pro.' }, { status: 500 })
  }
}

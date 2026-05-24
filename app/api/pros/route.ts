import { NextRequest } from 'next/server'
import { adminDb } from '@/firebase/admin'
import { hasPaidProFeatures } from '@/lib/billing'
import servicesData from '@/public/services.json'
import districtsData from '@/public/districts.json'

const RESULT_LIMIT = 12

type ProDoc = {
  id: string
  uid?: string
  fullName?: string
  categoryId?: string
  categoryName?: string
  services?: string[]
  districts?: number[]
  radius?: number
  postcode?: string
  bio?: string
  yearsExp?: string
  pricingType?: 'hourly' | 'fixed' | 'quote'
  hourlyRate?: string
  availability?: string[]
  avatarUrl?: string | null
  workPhotoUrls?: string[]
  pastProjects?: unknown[]
  backgroundCheck?: boolean
  profileVisibility?: 'visible' | 'paused'
  status?: string
  subscriptionStatus?: string
  subscriptionActive?: boolean
  subscriptionCurrentPeriodEnd?: Date | { toDate?: () => Date; toMillis?: () => number } | null
  rating?: number
  reviewCount?: number
  createdAt?: { toMillis?: () => number }
}

/** Find service names that match the query string. */
function matchingServices(q: string): string[] {
  const lq = q.toLowerCase()
  const results: string[] = []

  for (const cat of servicesData.categories) {
    // Whole-category match → include all its services (capped)
    if (cat.name.toLowerCase().includes(lq)) {
      results.push(...cat.services.slice(0, 6))
    } else {
      for (const svc of cat.services) {
        if (svc.toLowerCase().includes(lq)) results.push(svc)
      }
    }
    if (results.length >= 10) break
  }

  return [...new Set(results)].slice(0, 10) // Firestore array-contains-any max 10
}

function isPaidPro(pro: ProDoc): boolean {
  return hasPaidProFeatures(pro.subscriptionStatus, pro.subscriptionCurrentPeriodEnd)
}

export async function GET(request: NextRequest) {
  const rawQ = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  const districtRoman = request.nextUrl.searchParams.get('district') ?? ''

  const districtId = districtRoman
    ? (districtsData.districts.find(d => d.roman === districtRoman)?.id ?? null)
    : null

  try {
    const prosCol = adminDb.collection('pros')
    let docs: ProDoc[] = []

    if (rawQ) {
      const svcMatches = matchingServices(rawQ)

      if (svcMatches.length > 0) {
        const snap = await prosCol.where('services', 'array-contains-any', svcMatches).limit(RESULT_LIMIT * 3).get()
        docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProDoc))
      } else {
        const catMatch = servicesData.categories.find(c =>
          c.name.toLowerCase().includes(rawQ.toLowerCase())
        )
        if (catMatch) {
          const snap = await prosCol.where('categoryName', '==', catMatch.name).limit(RESULT_LIMIT * 3).get()
          docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProDoc))
        } else {
          const snap = await prosCol.where('status', '==', 'active').limit(RESULT_LIMIT * 3).get()
          docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProDoc))
        }
      }
    } else {
      const snap = await prosCol.where('status', '==', 'active').limit(RESULT_LIMIT * 3).get()
      docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProDoc))
    }

    docs = docs
      .filter(p => p.status === 'active' && p.profileVisibility !== 'paused')
      .sort((a, b) => {
        const aPaid = isPaidPro(a)
        const bPaid = isPaidPro(b)
        return Number(bPaid) - Number(aPaid)
          || (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      })

    // Post-filter by district (Firestore can't combine two array-contains)
    if (districtId) {
      docs = docs.filter(p => (p.districts ?? []).includes(districtId))
    }

    return Response.json({
      pros: docs.slice(0, RESULT_LIMIT).map(p => {
        const paid = isPaidPro(p)
        return {
          id: p.id,
          uid: p.uid ?? p.id,
          fullName: p.fullName ?? '',
          categoryId: p.categoryId ?? '',
          categoryName: p.categoryName ?? '',
          services: p.services ?? [],
          districts: p.districts ?? [],
          radius: p.radius ?? 10,
          postcode: p.postcode ?? '',
          bio: p.bio ?? '',
          yearsExp: p.yearsExp ?? '',
          pricingType: p.pricingType ?? 'quote',
          hourlyRate: p.hourlyRate ?? '',
          availability: p.availability ?? [],
          avatarUrl: p.avatarUrl ?? null,
          workPhotoUrls: p.workPhotoUrls ?? [],
          pastProjects: p.pastProjects ?? [],
          backgroundCheck: Boolean(p.backgroundCheck),
          subscriptionActive: paid,
          subscriptionStatus: p.subscriptionStatus ?? 'inactive',
          rating: paid && typeof p.rating === 'number' ? p.rating : null,
          reviewCount: paid && typeof p.reviewCount === 'number' ? p.reviewCount : 0,
          status: p.status ?? 'active',
        }
      }),
    })
  } catch (err) {
    console.error('[/api/pros]', err)
    return Response.json({ pros: [], error: String(err) })
  }
}

import { NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'
import { requireUser } from '@/firebase/adminAccess'
import { sendAdminNotification } from '@/firebase/adminNotifications'
import { sendLifecycleEmail } from '@/firebase/notifications'
import { huCategory } from '@/lib/i18n/email'
import { enforceUserRateLimit } from '@/lib/rateLimit'

type ServiceRequestDoc = {
  proUid?: string
  proName?: string
  customerUid?: string
  customerName?: string
  categoryName?: string
  status?: string
}

type ProAggregate = {
  rating?: number
  reviewCount?: number
  reviewRatingTotal?: number
}

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function cleanRating(value: unknown): number | null {
  const rating = Number(value)
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null
}

function publicCustomerName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Mestermind customer'
  const [first, ...rest] = parts
  const lastInitial = rest.at(-1)?.[0]
  return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

function stars(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

async function proEmail(proUid: string): Promise<string> {
  const snap = await adminDb.collection('pros').doc(proUid).collection('private').doc('account').get()
  const email = snap.data()?.email
  return typeof email === 'string' ? email.trim() : ''
}

function reviewPostedEmailText(input: {
  customerName: string
  categoryName: string
  rating: number
  comment: string
  profileUrl: string
}): string {
  return [
    `${input.customerName} left you a ${input.rating}/5 review for ${input.categoryName}.`,
    input.comment,
    `View your public reviews on Mestermind: ${input.profileUrl}`,
  ].join('\n\n')
}

function reviewPostedEmailHtml(input: {
  customerName: string
  categoryName: string
  rating: number
  comment: string
  profileUrl: string
}): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="height:112px;background:#fff7ed;border-radius:4px 4px 0 0;border-bottom:1px solid #f1d8c7;text-align:center;">
          <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">New review</div>
          <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">A customer reviewed your completed job</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
      <tr>
        <td style="padding:0 0 18px;">
          <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(input.customerName)} left you a review</h1>
          <div style="margin-top:10px;color:#f97316;font-size:24px;line-height:28px;letter-spacing:1px;">${stars(input.rating)}</div>
          <div style="margin-top:4px;color:#676d73;font-size:14px;line-height:20px;">${input.rating}/5 for ${escapeEmailHtml(input.categoryName)}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td style="padding:16px;background:#fafafa;border:1px solid #e9eced;border-radius:4px;">
          <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Customer comment</div>
          <div style="margin-top:6px;font-size:15px;line-height:23px;color:#676d73;white-space:pre-line;">${escapeEmailHtml(input.comment)}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
      <tr>
        <td style="background:#f97316;border-radius:4px;">
          <a href="${escapeEmailHtml(input.profileUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">View reviews</a>
        </td>
      </tr>
    </table>
  `
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const limited = await enforceUserRateLimit('authWrite', user.uid)
    if (limited) return limited

    const body = await request.json()
    const requestId = cleanString(body.requestId)
    const rating = cleanRating(body.rating)
    const comment = cleanString(body.comment).slice(0, 1200)

    if (!requestId) {
      return Response.json({ error: 'Request ID is required.' }, { status: 400 })
    }
    if (!rating) {
      return Response.json({ error: 'Choose a rating from 1 to 5.' }, { status: 400 })
    }
    if (comment.length < 20) {
      return Response.json({ error: 'Please share at least a sentence about the work.' }, { status: 400 })
    }

    const reviewRef = adminDb.collection('reviews').doc(requestId)
    const reqRef = adminDb.collection('serviceRequests').doc(requestId)

    const review = await adminDb.runTransaction(async transaction => {
      const [existingReviewSnap, reqSnap] = await Promise.all([
        transaction.get(reviewRef),
        transaction.get(reqRef),
      ])

      if (existingReviewSnap.exists) {
        throw new Error('ALREADY_REVIEWED')
      }
      if (!reqSnap.exists) {
        throw new Error('REQUEST_NOT_FOUND')
      }

      const serviceRequest = reqSnap.data() as ServiceRequestDoc
      if (serviceRequest.customerUid !== user.uid) {
        throw new Error('FORBIDDEN')
      }
      if (serviceRequest.status !== 'completed') {
        throw new Error('REQUEST_NOT_COMPLETED')
      }
      if (!serviceRequest.proUid) {
        throw new Error('PRO_NOT_FOUND')
      }

      const proRef = adminDb.collection('pros').doc(serviceRequest.proUid)
      const proSnap = await transaction.get(proRef)
      if (!proSnap.exists) {
        throw new Error('PRO_NOT_FOUND')
      }

      const pro = proSnap.data() as ProAggregate
      const currentCount = Number(pro.reviewCount ?? 0)
      const currentTotal = Number(pro.reviewRatingTotal ?? ((pro.rating ?? 0) * currentCount))
      const nextCount = currentCount + 1
      const nextTotal = currentTotal + rating
      const nextRating = Math.round((nextTotal / nextCount) * 10) / 10
      const customerName = publicCustomerName(serviceRequest.customerName || user.name || '')

      const reviewPayload = {
        requestId,
        proUid: serviceRequest.proUid,
        proName: serviceRequest.proName ?? '',
        customerUid: user.uid,
        customerName,
        categoryName: serviceRequest.categoryName ?? '',
        rating,
        comment,
        status: 'published',
        createdAt: FieldValue.serverTimestamp(),
      }

      transaction.set(reviewRef, reviewPayload)
      transaction.update(proRef, {
        rating: nextRating,
        reviewCount: nextCount,
        reviewRatingTotal: nextTotal,
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.update(reqRef, {
        review: {
          rating,
          comment,
          reviewedAt: FieldValue.serverTimestamp(),
        },
        statusHistory: FieldValue.arrayUnion({
          status: 'reviewed',
          actorUid: user.uid,
          actorRole: 'customer',
          at: new Date(),
        }),
      })

      return {
        requestId,
        proUid: serviceRequest.proUid,
        customerName,
        categoryName: serviceRequest.categoryName ?? '',
        rating,
        comment,
        aggregateRating: nextRating,
        reviewCount: nextCount,
      }
    })

    const profileUrl = appUrl(`/pro/${review.proUid}#reviews`)
    const categoryNameHu = huCategory(review.categoryName || 'your completed job')
    await sendLifecycleEmail({
      to: await proEmail(review.proUid),
      event: 'review.posted',
      requestId,
      subject: `${review.customerName} left you a review`,
      previewText: `${review.rating}/5 review for ${review.categoryName || 'your completed job'}.`,
      text: reviewPostedEmailText({
        customerName: review.customerName,
        categoryName: review.categoryName || 'your completed job',
        rating: review.rating,
        comment: review.comment,
        profileUrl,
      }),
      bodyHtml: reviewPostedEmailHtml({
        customerName: review.customerName,
        categoryName: review.categoryName || 'your completed job',
        rating: review.rating,
        comment: review.comment,
        profileUrl,
      }),
      localized: {
        hu: {
          subject: `${review.customerName} értékelést írt rólad`,
          previewText: `${review.rating}/5 értékelés ehhez: ${categoryNameHu}.`,
          text: [
            `${review.customerName} ${review.rating}/5 értékelést írt a(z) ${categoryNameHu} kapcsán.`,
            review.comment,
            `Nézd meg a nyilvános értékeléseidet a Mestermindben: ${profileUrl}`,
          ].join('\n\n'),
          bodyHtml: `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="height:112px;background:#fff7ed;border-radius:4px 4px 0 0;border-bottom:1px solid #f1d8c7;text-align:center;">
                  <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;">Új értékelés</div>
                  <div style="margin-top:8px;font-size:15px;line-height:22px;color:#676d73;">Egy ügyfél értékelte a befejezett munkád</div>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:24px;">
              <tr>
                <td style="padding:0 0 18px;">
                  <h1 style="margin:0;color:#2f3033;font-size:24px;line-height:32px;font-weight:700;">${escapeEmailHtml(review.customerName)} értékelést írt rólad</h1>
                  <div style="margin-top:10px;color:#f97316;font-size:24px;line-height:28px;letter-spacing:1px;">${stars(review.rating)}</div>
                  <div style="margin-top:4px;color:#676d73;font-size:14px;line-height:20px;">${review.rating}/5 ehhez: ${escapeEmailHtml(categoryNameHu)}</div>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:16px;background:#fafafa;border:1px solid #e9eced;border-radius:4px;">
                  <div style="font-size:14px;line-height:20px;color:#2f3033;font-weight:700;">Ügyfél megjegyzése</div>
                  <div style="margin-top:6px;font-size:15px;line-height:23px;color:#676d73;white-space:pre-line;">${escapeEmailHtml(review.comment)}</div>
                </td>
              </tr>
            </table>

            <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:22px 0 4px;">
              <tr>
                <td style="background:#f97316;border-radius:4px;">
                  <a href="${escapeEmailHtml(profileUrl)}" style="display:inline-block;padding:11px 24px;color:#ffffff;font-size:16px;line-height:24px;font-weight:700;text-decoration:none;">Értékelések megtekintése</a>
                </td>
              </tr>
            </table>
          `,
        },
      },
      hideSubjectHeading: true,
      metadata: {
        recipientUid: review.proUid,
        proUid: review.proUid,
        customerUid: user.uid,
        rating: review.rating,
        aggregateRating: review.aggregateRating,
        reviewCount: review.reviewCount,
      },
    })

    if (review.rating <= 2) {
      await sendAdminNotification({
        event: 'admin.review.low_rating_posted',
        subject: `Low review: ${review.rating}/5 for ${review.categoryName || 'job'}`,
        previewText: `${review.customerName} left a ${review.rating}/5 review.`,
        text: [
          'A customer posted a low review that may need follow-up.',
          `Rating: ${review.rating}/5`,
          `Customer: ${review.customerName} (${user.email ?? user.uid})`,
          `Pro UID: ${review.proUid}`,
          `Category: ${review.categoryName || 'Not provided'}`,
          `Comment:\n${review.comment}`,
        ].join('\n\n'),
        actionPath: `/requests/${requestId}`,
        requestId,
        metadata: {
          proUid: review.proUid,
          customerUid: user.uid,
          rating: review.rating,
          reviewCount: review.reviewCount,
        },
      })
    }

    return Response.json({ ok: true, review })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return Response.json({ error: 'You must be signed in.' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return Response.json({ error: 'Not allowed.' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'ALREADY_REVIEWED') {
      return Response.json({ error: 'You have already reviewed this job.' }, { status: 409 })
    }
    if (err instanceof Error && err.message === 'REQUEST_NOT_COMPLETED') {
      return Response.json({ error: 'You can review after the job is complete.' }, { status: 409 })
    }
    if (err instanceof Error && (err.message === 'REQUEST_NOT_FOUND' || err.message === 'PRO_NOT_FOUND')) {
      return Response.json({ error: 'Review target was not found.' }, { status: 404 })
    }
    console.error('[/api/reviews POST]', err)
    return Response.json({ error: 'Could not submit review.' }, { status: 500 })
  }
}

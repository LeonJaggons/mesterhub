import { randomBytes } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/firebase/admin'

export const PRO_REFERRAL_REWARD_FT = 3000

export type ReferralOwnerRole = 'customer' | 'pro'
export type ReferralStatus = 'pro_signup_submitted' | 'pro_approved' | 'reward_pending' | 'rewarded' | 'rejected'

export type ReferralSummary = {
  code: string
  inviteUrl: string
  rewardAmountFt: number
  referralCount: number
  approvedCount: number
  pendingRewardCount: number
  rewardedCount: number
  pendingRewardFt: number
  paidRewardFt: number
}

type ReferralCodeDoc = {
  code: string
  ownerUid: string
  ownerRole: ReferralOwnerRole
}

type ReferralDoc = {
  code: string
  referrerUid: string
  referrerRole: ReferralOwnerRole
  referredProUid: string
  status: ReferralStatus
  rewardAmountFt?: number
}

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function appUrl(path: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

export function cleanReferralCode(value: unknown): string {
  return cleanString(value)
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 16)
}

function candidateCode(uid: string): string {
  const uidPart = uid.replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase() || 'MEST'
  return `MM${uidPart}${randomBytes(2).toString('hex').toUpperCase()}`
}

export async function ensureReferralCode(uid: string, ownerRole: ReferralOwnerRole = 'customer'): Promise<string> {
  const existing = await adminDb.collection('referralCodes')
    .where('ownerUid', '==', uid)
    .where('ownerRole', '==', ownerRole)
    .limit(1)
    .get()

  if (!existing.empty) {
    return (existing.docs[0].data() as ReferralCodeDoc).code
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = candidateCode(uid)
    const codeRef = adminDb.collection('referralCodes').doc(code)
    const created = await adminDb.runTransaction(async transaction => {
      const codeSnap = await transaction.get(codeRef)
      if (codeSnap.exists) return false
      transaction.set(codeRef, {
        code,
        ownerUid: uid,
        ownerRole,
        usesCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      transaction.set(adminDb.collection(ownerRole === 'pro' ? 'pros' : 'users').doc(uid), {
        referralCode: code,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      return true
    })
    if (created) return code
  }

  throw new Error('Could not create a referral code.')
}

export async function referralSummary(uid: string, ownerRole: ReferralOwnerRole = 'customer'): Promise<ReferralSummary> {
  const code = await ensureReferralCode(uid, ownerRole)
  const referralsSnap = await adminDb.collection('referrals').where('referrerUid', '==', uid).get()
  const referrals = referralsSnap.docs.map(doc => doc.data() as ReferralDoc)
  const approvedCount = referrals.filter(referral => ['pro_approved', 'reward_pending', 'rewarded'].includes(referral.status)).length
  const pendingRewardCount = referrals.filter(referral => referral.status === 'reward_pending').length
  const rewarded = referrals.filter(referral => referral.status === 'rewarded')

  return {
    code,
    inviteUrl: appUrl(`/pro/signup?ref=${encodeURIComponent(code)}`),
    rewardAmountFt: PRO_REFERRAL_REWARD_FT,
    referralCount: referralsSnap.size,
    approvedCount,
    pendingRewardCount,
    rewardedCount: rewarded.length,
    pendingRewardFt: pendingRewardCount * PRO_REFERRAL_REWARD_FT,
    paidRewardFt: rewarded.reduce((total, referral) => total + (referral.rewardAmountFt ?? PRO_REFERRAL_REWARD_FT), 0),
  }
}

export async function claimProReferral(input: {
  referredProUid: string
  rawCode: unknown
  proName?: string
  proEmail?: string
}): Promise<{ claimed: boolean; reason?: string }> {
  const { referredProUid } = input
  const code = cleanReferralCode(input.rawCode)
  if (!code) return { claimed: false, reason: 'missing_code' }

  const codeRef = adminDb.collection('referralCodes').doc(code)
  const proRef = adminDb.collection('pros').doc(referredProUid)
  const referralRef = adminDb.collection('referrals').doc(referredProUid)

  return adminDb.runTransaction(async transaction => {
    const [codeSnap, proSnap, referralSnap] = await Promise.all([
      transaction.get(codeRef),
      transaction.get(proRef),
      transaction.get(referralRef),
    ])

    if (!codeSnap.exists) return { claimed: false, reason: 'invalid_code' }
    const referralCode = codeSnap.data() as ReferralCodeDoc
    if (referralCode.ownerUid === referredProUid) return { claimed: false, reason: 'self_referral' }
    if (referralSnap.exists || cleanString(proSnap.data()?.referredByUid)) {
      return { claimed: false, reason: 'already_referred' }
    }

    transaction.set(referralRef, {
      code,
      referrerUid: referralCode.ownerUid,
      referrerRole: referralCode.ownerRole,
      referredProUid,
      referredProName: cleanString(input.proName),
      referredProEmail: cleanString(input.proEmail),
      status: 'pro_signup_submitted',
      rewardAmountFt: PRO_REFERRAL_REWARD_FT,
      rewardCurrency: 'HUF',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.set(proRef, {
      referredByCode: code,
      referredByUid: referralCode.ownerUid,
      referredByRole: referralCode.ownerRole,
      referralStatus: 'pro_signup_submitted',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.update(codeRef, {
      usesCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { claimed: true }
  })
}

export async function markProReferralApproved(referredProUid: string): Promise<{ rewarded: boolean; referrerUid?: string; amountFt?: number }> {
  const referralRef = adminDb.collection('referrals').doc(referredProUid)
  const proRef = adminDb.collection('pros').doc(referredProUid)
  return adminDb.runTransaction(async transaction => {
    const referralSnap = await transaction.get(referralRef)
    if (!referralSnap.exists) return { rewarded: false }
    const referral = referralSnap.data() as ReferralDoc
    if (referral.status === 'reward_pending' || referral.status === 'rewarded' || referral.status === 'rejected') {
      return { rewarded: false }
    }
    if (referral.referrerUid === referredProUid) return { rewarded: false }
    const referrerCollection = referral.referrerRole === 'pro' ? 'pros' : 'users'
    const referrerRef = adminDb.collection(referrerCollection).doc(referral.referrerUid)
    const amountFt = referral.rewardAmountFt ?? PRO_REFERRAL_REWARD_FT
    const rewardRef = adminDb.collection('referralRewards').doc(referredProUid)

    transaction.update(referralRef, {
      status: 'reward_pending',
      proApprovedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    transaction.set(rewardRef, {
      referralId: referredProUid,
      referrerUid: referral.referrerUid,
      referrerRole: referral.referrerRole,
      referredProUid,
      amountFt,
      currency: 'HUF',
      status: 'pending_manual_payout',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.set(referrerRef, {
      referralPendingRewardFt: FieldValue.increment(amountFt),
      referralApprovedPros: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    transaction.set(proRef, {
      referralStatus: 'reward_pending',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    return {
      rewarded: true,
      referrerUid: referral.referrerUid,
      amountFt,
    }
  })
}

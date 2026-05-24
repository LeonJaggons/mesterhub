'use client'

import Link from 'next/link'
import { MdVerified, MdLocationOn, MdStar } from 'react-icons/md'
import {
  dg,
  districtNameById,
  pricingLabel,
  proAvatarBg,
  proInitials,
  type ProSummary,
} from '../shared'

export function ProAvatar({ pro, size = 56 }: { pro: ProSummary; size?: number }) {
  if (pro.avatarUrl) {
    return (
      <img
        src={pro.avatarUrl}
        alt={pro.fullName}
        className="rounded-full object-cover border-2 border-white shadow-sm shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm"
      style={{
        width: size,
        height: size,
        background: proAvatarBg(pro.fullName),
        fontSize: size * 0.34,
      }}
    >
      {proInitials(pro.fullName)}
    </div>
  )
}

export function ProRating({ pro }: { pro: ProSummary }) {
  const rating = pro.rating
  const count = pro.reviewCount ?? 0
  if (!pro.subscriptionActive) {
    return <p className="text-xs font-semibold text-gray-400">Reviews available with Pro</p>
  }
  if (!rating || count === 0) {
    return <p className="text-xs font-semibold text-gray-400">No reviews yet</p>
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-800 font-bold text-sm">{rating.toFixed(1)}</span>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <MdStar
            key={i}
            size={14}
            color={i <= Math.round(rating) ? '#f97316' : '#d1d5db'}
          />
        ))}
      </span>
      {count > 0 && <span className="text-xs text-gray-400">({count})</span>}
    </div>
  )
}

/** Sidebar / detail pro panel */
export function ProDetailCard({ pro }: { pro: ProSummary }) {
  const topDistricts = pro.districts.slice(0, 4)
  const moreDistricts = pro.districts.length - topDistricts.length

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-20 bg-gradient-to-br from-orange-400 to-orange-600" />
      <div className="px-5 pb-5 -mt-10">
        <ProAvatar pro={pro} size={72} />
        <div className="mt-3">
          <Link
            href={`/pro/${pro.uid}`}
            className="text-xl font-black text-gray-900 hover:text-orange-600 transition-colors"
            style={dg}
          >
            {pro.fullName}
          </Link>
          <p className="text-sm text-gray-500 mt-0.5">{pro.categoryName}</p>
          <div className="mt-2">
            <ProRating pro={pro} />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {pro.subscriptionActive && (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              <MdVerified size={14} /> Verified
            </span>
          )}
          {pro.regulated && (
            <span className="text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              Licensed trade
            </span>
          )}
          {pro.yearsExp && (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
              {pro.yearsExp} experience
            </span>
          )}
        </div>

        {pro.bio && (
          <p className="text-sm text-gray-600 mt-4 leading-relaxed line-clamp-4">{pro.bio}</p>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Typical pricing</p>
            <p className="text-sm font-semibold text-gray-900">{pricingLabel(pro)}</p>
          </div>

          {pro.services.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Services</p>
              <div className="flex flex-wrap gap-1">
                {pro.services.slice(0, 5).map(s => (
                  <span
                    key={s}
                    className="text-xs bg-orange-50 text-orange-800 border border-orange-100 rounded-full px-2 py-0.5"
                  >
                    {s}
                  </span>
                ))}
                {pro.services.length > 5 && (
                  <span className="text-xs text-gray-400">+{pro.services.length - 5} more</span>
                )}
              </div>
            </div>
          )}

          {topDistricts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5 flex items-center gap-1">
                <MdLocationOn size={14} /> Serves
              </p>
              <p className="text-sm text-gray-700">
                {topDistricts.map(id => districtNameById(id)).join(', ')}
                {moreDistricts > 0 ? ` +${moreDistricts} more` : ''}
              </p>
            </div>
          )}

          {pro.postcode && (
            <p className="text-xs text-gray-400">Based near {pro.postcode}</p>
          )}
        </div>

        <Link
          href={`/pro/${pro.uid}`}
          className="mt-5 block w-full text-center py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          View full profile
        </Link>
      </div>
    </div>
  )
}

/** Compact row for list cards */
export function ProListSnippet({ pro }: { pro: ProSummary }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <ProAvatar pro={pro} size={48} />
      <div className="min-w-0">
        <p className="font-bold text-gray-900 truncate" style={dg}>{pro.fullName}</p>
        <p className="text-xs text-gray-500 truncate">{pro.categoryName}</p>
        <ProRating pro={pro} />
      </div>
    </div>
  )
}

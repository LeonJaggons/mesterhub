'use client'

import { dg } from '@/lib/ui'

const VARIANT_CLASSES = {
  primary: 'bg-sky-500 hover:bg-sky-600 text-white font-black border-none',
  secondary: 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold',
  danger: 'bg-gray-900 hover:bg-gray-800 text-white font-black border-none',
  destructive: 'bg-red-600 hover:bg-red-700 text-white font-black border-none',
} as const

export type ButtonVariant = keyof typeof VARIANT_CLASSES

export function Button({ variant = 'primary', full, className = '', style, children, ...props }: {
  variant?: ButtonVariant
  full?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const useHeadingFont = variant !== 'secondary'
  return (
    <button
      {...props}
      className={`${full ? 'flex-1' : ''} ${VARIANT_CLASSES[variant]} rounded-md py-3 text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={useHeadingFont ? { ...dg, ...style } : style}
    >
      {children}
    </button>
  )
}

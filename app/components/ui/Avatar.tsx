export const AVATAR_COLORS = ['#0284c7', '#1e293b'] as const

export function initials(name: string, fallback = '?'): string {
  return name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || fallback
}

export function avatarBg(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}

export function AvatarCircle({ className = '', style, children }: {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <div className={`rounded-full flex items-center justify-center font-bold shrink-0 ${className}`} style={style}>
      {children}
    </div>
  )
}

export function Avatar({ name, src, size = 40, className = '' }: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover border-2 border-white shadow-sm shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <AvatarCircle
      className={`text-white shadow-sm ${className}`}
      style={{ width: size, height: size, background: avatarBg(name), fontSize: size * 0.34 }}
    >
      {initials(name)}
    </AvatarCircle>
  )
}

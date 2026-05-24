import { avatarColor, partnerInitials } from './utils'
import styles from './messages.module.css'

export default function MessageAvatar({
  name,
  imageUrl,
  size = 'md',
}: {
  name: string
  imageUrl?: string | null
  size?: 'md' | 'sm'
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${styles.avatar} ${size === 'sm' ? styles.avatarSm : ''}`}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={`${styles.avatar} ${size === 'sm' ? styles.avatarSm : ''}`}
      style={{ background: avatarColor(name) }}
      aria-hidden
    >
      {partnerInitials(name)}
    </div>
  )
}

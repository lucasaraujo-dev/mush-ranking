interface PlayerIdentityCardProps {
  avatarUrl?: string
  message: string
  status: 'error' | 'idle' | 'loading' | 'success'
  subtitle?: string
  title: string
}

export function PlayerIdentityCard({
  avatarUrl,
  message,
  status,
  subtitle,
  title,
}: PlayerIdentityCardProps) {
  return (
    <article className={`player-card player-card-${status}`} aria-live="polite">
      <div className="player-card-avatar-shell">
        {avatarUrl ? (
          <img alt={title} className="player-card-avatar" height="56" src={avatarUrl} width="56" />
        ) : (
          <div className="player-card-avatar player-card-avatar-placeholder" aria-hidden="true" />
        )}
      </div>

      <div className="player-card-copy">
        <strong className="player-card-title">{title}</strong>
        {subtitle ? <span className="player-card-subtitle">{subtitle}</span> : null}
        <span className="player-card-message">{message}</span>
      </div>
    </article>
  )
}

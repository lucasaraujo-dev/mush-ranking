import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'

interface PlayerIdentityStat {
  label: string
  value: string
}

interface PlayerIdentityBadge {
  color?: string
  label: string
}

interface PlayerIdentityCardProps {
  accentColor?: string
  avatarUrl?: string
  badges?: PlayerIdentityBadge[]
  message: string
  previewDescription?: string
  previewSkinUrl?: string
  previewStats?: PlayerIdentityStat[]
  status: 'error' | 'idle' | 'loading' | 'success'
  subtitle?: string
  title: string
}

export function PlayerIdentityCard({
  accentColor,
  avatarUrl,
  badges = [],
  message,
  previewDescription,
  previewSkinUrl,
  previewStats = [],
  status,
  subtitle,
  title,
}: PlayerIdentityCardProps) {
  const hoverDelayTimeoutRef = useRef<number | null>(null)
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const statusLabel = {
    error: 'Erro',
    idle: 'Pronto',
    loading: 'Buscando',
    success: 'Perfil',
  } as const
  const hasPreview = Boolean(previewSkinUrl || previewStats.length > 0)
  const cardStyle = accentColor
    ? ({ '--player-accent': accentColor } as CSSProperties)
    : undefined

  useEffect(() => {
    return () => {
      if (hoverDelayTimeoutRef.current !== null) {
        window.clearTimeout(hoverDelayTimeoutRef.current)
      }
    }
  }, [])

  function openPreviewWithDelay() {
    if (!hasPreview) {
      return
    }

    if (hoverDelayTimeoutRef.current !== null) {
      window.clearTimeout(hoverDelayTimeoutRef.current)
    }

    hoverDelayTimeoutRef.current = window.setTimeout(() => {
      setIsPreviewVisible(true)
      hoverDelayTimeoutRef.current = null
    }, 1000)
  }

  function closePreview() {
    if (hoverDelayTimeoutRef.current !== null) {
      window.clearTimeout(hoverDelayTimeoutRef.current)
      hoverDelayTimeoutRef.current = null
    }

    setIsPreviewVisible(false)
  }

  return (
    <article
      aria-live="polite"
      className={`player-card player-card-${status}`}
      onMouseEnter={openPreviewWithDelay}
      onMouseLeave={closePreview}
      style={cardStyle}
    >
      <div className="player-card-avatar-shell">
        <div className="player-card-avatar-frame">
          {avatarUrl ? (
            <img alt={title} className="player-card-avatar" height="56" src={avatarUrl} width="56" />
          ) : (
            <div className="player-card-avatar player-card-avatar-placeholder" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="player-card-copy">
        <div className="player-card-topline">
          <span className={`player-card-status-pill player-card-status-pill-${status}`}>
            {statusLabel[status]}
          </span>
          <strong className="player-card-title">{title}</strong>
        </div>
        {subtitle ? <span className="player-card-subtitle">{subtitle}</span> : null}
        {badges.length > 0 ? (
          <div className="player-card-badges">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className="player-card-badge"
                style={
                  badge.color
                    ? ({ '--player-badge-accent': badge.color } as CSSProperties)
                    : undefined
                }
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
        <span className="player-card-message">{message}</span>
      </div>

      {hasPreview && isPreviewVisible ? (
        <aside className="player-card-preview" aria-label="Resumo rapido do perfil">
          <div className="player-card-preview-skin-panel">
            {previewSkinUrl ? (
              <img
                alt={`Skin completa de ${subtitle ?? title}`}
                className="player-card-preview-skin"
                src={previewSkinUrl}
              />
            ) : null}
          </div>

          <div className="player-card-preview-copy">
            <span className="player-card-preview-eyebrow">Hover do perfil</span>
            <strong className="player-card-preview-title">{subtitle ?? title}</strong>
            {previewDescription ? (
              <p className="player-card-preview-description">{previewDescription}</p>
            ) : null}
            {badges.length > 0 ? (
              <div className="player-card-preview-badges">
                {badges.map((badge) => (
                  <span
                    key={badge.label}
                    className="player-card-preview-badge"
                    style={
                      badge.color
                        ? ({ '--player-badge-accent': badge.color } as CSSProperties)
                        : undefined
                    }
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}

            {previewStats.length > 0 ? (
              <div className="player-card-preview-stats">
                {previewStats.map((stat) => (
                  <div className="player-card-preview-stat" key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      ) : null}
    </article>
  )
}

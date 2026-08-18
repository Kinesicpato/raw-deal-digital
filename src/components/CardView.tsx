import type { CardDef } from '../data/types'
import { getCardSafe } from '../store/useAppStore'

export type CardSize = 'lg' | 'md' | 'sm' | 'xs'

export function cardTypeLabel(c: CardDef): string {
  const parts: string[] = [c.type]
  if (c.extraTypes) parts.push(...c.extraTypes)
  if (c.subtypes && c.subtypes.length > 0) parts.push(c.subtypes.join('/'))
  return parts.join(' · ')
}

/** Generates the PNG filename for a card (created by scripts/generate_cards.py). */
export function cardArtUrl(c: CardDef): string {
  return `/cards/${c.id}.png`
}

/** The full card rendered as a single raster image (never depends on CSS layout). */
export function CardArt({ c, title }: { c: CardDef; title: string }) {
  return <img src={cardArtUrl(c)} alt={title} className="cf-art" draggable={false} aria-hidden />
}

export function CardFace({
  id,
  size = 'sm',
  onClick,
  onMouseEnter,
  onMouseLeave,
  playable,
  faceDown,
  selected,
}: {
  id: string
  size?: CardSize
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  playable?: boolean
  faceDown?: boolean
  selected?: boolean
}) {
  const c = getCardSafe(id)
  const cls = [
    'cardface',
    size,
    `type-${c.type}`,
    c.traits?.includes('Chain') ? 'traits-chain' : '',
    playable ? 'playable' : '',
    faceDown ? 'cf-back' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const src = faceDown ? '/cards/__back.png' : cardArtUrl(c)
  return (
    <div
      className={cls}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={`${c.name} — ${cardTypeLabel(c)}`}
      style={selected ? { boxShadow: '0 0 0 3px var(--gold)' } : undefined}
    >
      <img src={src} alt={`${c.name} — ${cardTypeLabel(c)}`} className="cf-art" draggable={false} />
    </div>
  )
}

/** Modal that shows the full card details. */
export function CardDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  if (!id) return null
  const c = getCardSafe(id)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <CardFace id={id} size="lg" />
          <div className="grid" style={{ flex: 1, gap: 6 }}>
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            <div className="muted">{cardTypeLabel(c)}</div>
            <div className="row">
              <span className="stat-chip">
                Fortitud <b>{c.fortitude}F</b>
              </span>
              <span className="stat-chip">
                Daño <b>{c.damage}D</b>
              </span>
              {c.stun ? (
                <span className="stat-chip">
                  Stun <b>{'★'.repeat(c.stun)}</b>
                </span>
              ) : null}
            </div>
            {c.traits && c.traits.length > 0 ? (
              <div className="row">
                {c.traits.map((t) => (
                  <span key={t} className="stat-chip">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <p style={{ lineHeight: 1.5, margin: 0 }}>{c.text}</p>
            {c.backlash ? <div className="muted">Backlash: {c.backlash}</div> : null}
            {c.notes ? <div className="muted">Nota: {c.notes}</div> : null}
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

/** Modal asking whether to remove a card from the deck or go back. */
export function CardRemoveModal({
  id,
  onConfirm,
  onCancel,
}: {
  id: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!id) return null
  const c = getCardSafe(id)
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <CardFace id={id} size="lg" />
          <div className="grid" style={{ flex: 1, gap: 6 }}>
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            <div className="muted">{cardTypeLabel(c)}</div>
            <div className="row">
              <span className="stat-chip">
                Fortitud <b>{c.fortitude}F</b>
              </span>
              <span className="stat-chip">
                Daño <b>{c.damage}D</b>
              </span>
              {c.stun ? (
                <span className="stat-chip">
                  Stun <b>{'★'.repeat(c.stun)}</b>
                </span>
              ) : null}
            </div>
            <p style={{ lineHeight: 1.5, margin: 0 }}>{c.text}</p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end', gap: 8 }}>
          <button className="ghost" onClick={onCancel}>
            Atrás
          </button>
          <button className="danger" onClick={onConfirm}>
            Eliminar del mazo
          </button>
        </div>
      </div>
    </div>
  )
}
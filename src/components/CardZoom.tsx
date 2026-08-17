import type { CardDef } from '../data/types'
import { getCardSafe, useAppStore } from '../store/useAppStore'
import { CardArt, cardTypeLabel } from './CardView'

/**
 * Floating zoom preview: shows an enlarged version of the hovered card so it
 * can be inspected without playing it. Purely visual (pointer-events none).
 * While a decision/modal is open it is suppressed so it never covers the
 * action buttons (stop damage, reversal, end turn).
 */
export function CardZoomPreview({ id }: { id: string | null }) {
  const pending = useAppStore((s) => s.game?.pendingDecision)
  if (pending || !id) return null
  const c = getCardSafe(id)
  return (
    <div className="zoom-preview" key={id}>
      <CardArt c={c} title={`${c.name} — ${cardTypeLabel(c)}`} />
      <div className="zoom-info">
        <div className="zoom-name">{c.name}</div>
        <div className="muted">{cardTypeLabel(c)}</div>
        <ZoomStats c={c} />
        <div className="zoom-text">{c.text}</div>
      </div>
    </div>
  )
}

export function ZoomStats({ c }: { c: CardDef }) {
  return (
    <div className="zoom-stats">
      <span className="stat-chip badge-fort mono">F {c.fortitude}</span>
      <span className="stat-chip mono">{c.damage}D</span>
      {c.stun ? <span className="stat-chip mono">Stun {'★'.repeat(c.stun)}</span> : null}
      {c.backlash ? <span className="stat-chip mono">Backlash {c.backlash}</span> : null}
    </div>
  )
}